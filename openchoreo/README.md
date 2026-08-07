# OpenChoreo Deployment

Deploys the FHIR Canvas Explorer onto an [OpenChoreo](https://openchoreo.dev)
data plane as a reference architecture for running WSO2 Open Healthcare
workloads on a self-managed Kubernetes cluster.

Descriptors target the OpenChoreo **v1.x** API (`openchoreo.dev/v1alpha1`
after the 1.0 rework: `componentType` refs, `dockerfile-builder` workflow,
singular `container`, `project`/`external` endpoint visibility).

## Topology

```
internet ── OpenChoreo gateway (Envoy, TLS)
              │
              ▼  visibility: external
        explorer-nginx      stock nginx, security headers, reverse proxy
              │
              ▼  visibility: project
        explorer-web        Next.js UI + API routes
              │                └─ fhir-mcp-server: stdio child process,
              │                   no network endpoint at all
              ▼  visibility: project
        fhir-server         Go FHIR R4 server (wso2-fhir-server repo)
              │
              ▼  visibility: project
        fhir-postgres       platform-provisioned in-cluster postgres
```

Each project maps to a cell (namespace); OpenChoreo generates NetworkPolicies
from endpoint visibility, so `explorer-nginx` is the only tier the gateway
routes external traffic to. `project` visibility scopes the inner tiers to
the cell. Finer-grained
"only-nginx-may-call-web" pinning inside the cell is not expressible via
visibility alone today; the rate limiter keys on nginx's `X-Real-IP`, so
traffic that bypasses nginx lands in the shared fail-closed bucket.

## Layout

| Directory | Purpose |
| --- | --- |
| `project/` | Project + development ProjectReleaseBinding |
| `nginx/` | Edge proxy Component + Workload (external endpoint) |
| `web/` | Next.js app Component + Workload + OpenAI SecretReference |
| `fhir-server/` | FHIR R4 server Component + Workload (project endpoint) |
| `postgres/` | Postgres Resource + development ResourceReleaseBinding |
| `platform/` | Once-per-data-plane setup (gateway client-address policy) |
| `seed-secrets.sh` | Seeds the OpenBao entries from .env.local / the environment |

## Prerequisites

Tooling is provisioned through [devbox](https://www.jetify.com/devbox)
(see `devbox.json` at the repo root):

```sh
devbox shell            # node, bun, kubectl, helm, k3d, jq
devbox run install-occ  # OpenChoreo CLI into .devbox/bin
```

You also need an OpenChoreo control plane reachable from `kubectl` (for local
evaluation, the OpenChoreo docs set one up on k3d) with:

- the getting-started bundle applied (environments, `default` deployment
  pipeline, `deployment/*` ClusterComponentTypes, `dockerfile-builder`
  ClusterWorkflow, `postgres` ClusterResourceType), and
- a secret store wired to External Secrets Operator (seed-secrets.sh writes
  the `fhir-canvas-explorer-openai-api-key` entry), and
- the control plane installed with `backstage.auth.oidcScope="openid profile
  email groups"` — the chart's default scope omits `groups`, so user tokens
  carry no groups claim, every AuthzRoleBinding match fails, and the portal
  renders zero projects even though the catalog syncs them fine.

## Applying (development environment)

```sh
./openchoreo/seed-secrets.sh
kubectl apply -f openchoreo/project -f openchoreo/postgres \
  -f openchoreo/fhir-server -f openchoreo/web -f openchoreo/nginx
```

Secrets are injected as env vars, so rotating a value in the store needs a
pod restart to take effect — `seed-secrets.sh` does this for the OpenAI key.

Builds are triggered by creating a `WorkflowRun` per source-built component
(or pushing with `autoBuild` + webhook); the run wires the published image
into the component's Workload automatically and autoDeploy rolls it out.
Promotion to staging/production is done by adding the
corresponding `ProjectReleaseBinding`s and advancing them.

## Validation status

Validated end to end on a manual k3d install (charts 1.2.2): all four tiers
run, and gateway → nginx → Next.js → `/api/fhir` proxy → FHIR server →
postgres serves 200s with the security headers and SSRF allowlist intact.

Platform findings from that pass:

- Workloads must be named `<component>-workload` (they are here): the build
  pipeline's `generate-workload` step writes exactly that CR, so any other
  name creates a colliding sibling and wedges the component controller.
  With no `workload.yaml` descriptor in the source repo, a build updates only
  `container.image` on the existing Workload (env, endpoints, dependencies
  preserved) and autoDeploy rolls it out — verified end to end. The
  checked-in image tags are just the bootstrap values; the pipeline owns the
  field afterwards. Adding a source-repo descriptor flips ownership: builds
  then fully replace the Workload from the descriptor.
- The stock `containerfile-build` template runs podman under user-mode
  networking (pasta), which cannot sustain `bun install`'s registry traffic —
  parallel connections get refused and serial runs exhaust its flow table
  (Go builds, one HTTP/2 connection, are unaffected). Fixed by patching the
  ClusterWorkflowTemplate to `podman build --network=host`, which runs RUN
  steps in the build pod's own CNI network; all three images then build
  in-cluster. Worth an upstream issue.
- Workload edits alone do not recut a ComponentRelease; delete the stale
  release (or change the Component spec) to force a new one.
- If the host machine's DNS search domain leaks into pods (k3d inherits it)
  and that domain wildcard-answers, musl-based images cannot resolve external
  names (the chatbot's OpenAI calls fail with ENOTFOUND); a CoreDNS override
  returning NXDOMAIN for that domain fixes it.

## Remaining work

- [ ] Environment promotion (dev → staging) with per-env config overrides
- [ ] Production DB posture: point the postgres Resource at a managed
      instance; drop `FHIR_CREATE_TABLES`
- [ ] CSP nonce follow-up from PR #22 applies to the nginx config here

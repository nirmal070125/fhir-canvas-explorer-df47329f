# OpenChoreo Deployment

Deploys the FHIR Canvas Explorer onto an [OpenChoreo](https://openchoreo.dev)
data plane. Descriptors target the v1.x API (`openchoreo.dev/v1alpha1`).

## Topology

```
internet ── OpenChoreo gateway (Envoy, TLS)
              │
              ▼  visibility: external
        explorer-nginx      stock nginx, security headers, reverse proxy
              │
              ▼  visibility: project
        explorer-web        Next.js UI + API routes (MCP as stdio subprocess)
              │
              ▼  visibility: project
        fhir-server         Go FHIR R4 server (wso2/fhir-server)
              │
              ▼  visibility: project
        fhir-postgres       platform-provisioned postgres
```

The project maps to a cell (namespace); NetworkPolicies are generated from
endpoint visibility, so only `explorer-nginx` is externally reachable.

## Layout

| Directory | Purpose |
| --- | --- |
| `project/` | Project + development ProjectReleaseBinding |
| `nginx/` | Edge proxy Component + Workload (external endpoint) |
| `web/` | Next.js app Component + Workload (LLM traffic via the AI gateway trait) |
| `fhir-server/` | FHIR R4 server Component + Workload |
| `postgres/` | Postgres Resource + development ResourceReleaseBinding |
| `platform/` | Once-per-data-plane setup: client-address policy, route-timeout trait, AI gateway (`platform/ai-gateway/`, upstream module files vendored under `upstream/`) |
| `setup.sh` | One-shot platform setup (applies everything under `platform/`) |
| `seed-secrets.sh` | Seeds the OpenBao entries from .env.local / the environment |

## Prerequisites

Tooling comes from [devbox](https://www.jetify.com/devbox) (`devbox.json` at
the repo root): `devbox shell`, then `devbox run install-occ`.

An OpenChoreo control plane reachable from `kubectl`, with the
getting-started bundle applied, a secret store wired to External Secrets
Operator, and `backstage.auth.oidcScope="openid profile email groups"` — the
default scope omits `groups`, which leaves the portal empty.

## Applying (development)

Platform setup, once per data plane:

```sh
./openchoreo/seed-secrets.sh   # OpenAI key into OpenBao
./openchoreo/setup.sh          # client-address policy, traits, AI gateway
```

Then the app:

```sh
kubectl apply -f openchoreo/project -f openchoreo/postgres \
  -f openchoreo/fhir-server -f openchoreo/web -f openchoreo/nginx
```

Builds: create a `WorkflowRun` per source-built component; the pipeline wires
the image into the Workload and autoDeploy rolls it out. Promote by adding
per-environment `ProjectReleaseBinding`s. Rotated secrets need a pod restart
(env vars); `seed-secrets.sh` handles this for the OpenAI key.

## Platform findings

Validated end to end on a manual k3d install (charts 1.2.2). Gotchas hit:

- Workloads must be named `<component>-workload`; the build pipeline's
  `generate-workload` step writes that CR and any other name wedges the
  component controller. Checked-in image tags are bootstrap values only.
- The stock build template's user-mode networking (pasta) cannot sustain
  `bun install`; patch the ClusterWorkflowTemplate to
  `podman build --network=host`.
- Workload edits alone do not recut a ComponentRelease; delete the stale
  release to force one.
- Workload `container.env` lands in an envFrom ConfigMap/Secret: dependency
  `envBindings` shadow same-named manual vars, and `$(VAR)` in manual env is
  never expanded.
- A leaked wildcard-answering DNS search domain breaks name resolution in
  musl images; fix with a CoreDNS NXDOMAIN override.
- Generated HTTPRoutes carry no timeouts, so Envoy's 15s default cuts off the
  chat tool loop; the `http-route-timeout` trait (platform/) patches the route
  to 75s on the nginx component.
- The WSO2 AI gateway stores its API config in pod-local sqlite: recreating
  the gateway orphans existing LlmProxies. Delete the component's
  RenderedRelease to force a re-apply.

Quirks after a k3d cluster restart:

- The quickstart OpenBao runs in dev mode (in-memory): re-run
  `seed-secrets.sh` after every cluster restart or ExternalSecrets go stale.
- k3d regenerates CoreDNS NodeHosts without `host.k3d.internal`, which breaks
  the `*.openchoreo.localhost` rewrite (portal login fails with
  "Failed to obtain access token"); re-add `<docker network gateway IP>
  host.k3d.internal` to the `coredns` ConfigMap's NodeHosts and restart
  CoreDNS.
- The cluster load balancer binds host port 8080; anything else holding it
  (e.g. the docker-compose dev stack) leaves the LB crash-looping and the
  API server unreachable.

## Remaining work

- [ ] Environment promotion (dev → staging) with per-env config overrides
- [ ] Production DB: managed postgres, drop `FHIR_CREATE_TABLES`
- [ ] CSP nonce follow-up from PR #22

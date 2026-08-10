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
| `web/` | Next.js app Component + Workload + OpenAI SecretReference |
| `fhir-server/` | FHIR R4 server Component + Workload |
| `postgres/` | Postgres Resource + development ResourceReleaseBinding |
| `platform/` | Once-per-data-plane gateway client-address policy |
| `seed-secrets.sh` | Seeds the OpenBao entries from .env.local / the environment |

## Prerequisites

Tooling comes from [devbox](https://www.jetify.com/devbox) (`devbox.json` at
the repo root): `devbox shell`, then `devbox run install-occ`.

An OpenChoreo control plane reachable from `kubectl`, with the
getting-started bundle applied, a secret store wired to External Secrets
Operator, and `backstage.auth.oidcScope="openid profile email groups"` — the
default scope omits `groups`, which leaves the portal empty.

## Applying (development)

```sh
./openchoreo/seed-secrets.sh
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

## Remaining work

- [ ] Environment promotion (dev → staging) with per-env config overrides
- [ ] Production DB: managed postgres, drop `FHIR_CREATE_TABLES`
- [ ] CSP nonce follow-up from PR #22

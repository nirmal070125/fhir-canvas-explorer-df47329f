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
        explorer-nginx      security headers, reverse proxy (deploy/nginx)
              │
              ▼  visibility: project
        explorer-web        Next.js UI + API routes
              │                └─ fhir-mcp-server: stdio child process,
              │                   no network endpoint at all
              ▼  visibility: project
        fhir-server         Go FHIR R4 server (wso2-fhir-server repo)
              │
              ▼  visibility: project
        fhir-db             postgres 16 + persistent-volume trait
```

Each project maps to a cell (namespace); OpenChoreo generates NetworkPolicies
from endpoint visibility, so only `explorer-nginx` is reachable from outside.
`project` visibility scopes the inner tiers to the cell. Finer-grained
"only-nginx-may-call-web" pinning inside the cell is not expressible via
visibility alone today; the rate limiter keys on nginx's `X-Real-IP`, so
traffic that bypasses nginx lands in the shared fail-closed bucket.

## Layout

| File | Purpose |
| --- | --- |
| `project.yaml` | Project + development ProjectReleaseBinding |
| `explorer-nginx.yaml` | Edge proxy Component + Workload (external endpoint) |
| `explorer-web.yaml` | Next.js app Component + Workload (project endpoint) |
| `fhir-server.yaml` | FHIR R4 server Component + Workload (project endpoint) |
| `postgres.yaml` | Postgres Component (persistent-volume trait) + Workload |
| `secrets.yaml` | SecretReferences for the OpenAI key and DB credentials |

## Prerequisites

Tooling is provisioned through [devbox](https://www.jetify.com/devbox)
(see `devbox.json` at the repo root):

```sh
devbox shell            # node, bun, kubectl, helm, kind, jq
devbox run install-occ  # OpenChoreo CLI into .devbox/bin
```

You also need an OpenChoreo control plane reachable from `kubectl` (for local
evaluation, the OpenChoreo quick-start sets one up on kind) with:

- the getting-started bundle applied (environments, `default` deployment
  pipeline, `deployment/*` ClusterComponentTypes, `dockerfile-builder`
  ClusterWorkflow, `persistent-volume` trait), and
- a secret store wired to External Secrets Operator containing the three
  entries named in `secrets.yaml` (`fhir-canvas-explorer-openai-api-key`,
  `fhir-canvas-explorer-database-url`, `fhir-canvas-explorer-db-password`).

## Applying (development environment)

```sh
kubectl apply -f openchoreo/project.yaml
kubectl apply -f openchoreo/secrets.yaml
kubectl apply -f openchoreo/postgres.yaml
kubectl apply -f openchoreo/fhir-server.yaml
kubectl apply -f openchoreo/explorer-web.yaml
kubectl apply -f openchoreo/explorer-nginx.yaml
```

Builds are triggered by creating a `WorkflowRun` per source-built component
(or pushing with `autoBuild` + webhook); the built image then replaces the
placeholder `container.image`. Promotion to staging/production is done by
adding the corresponding `ProjectReleaseBinding`s and advancing them.

## Remaining work

- [ ] Validate WorkflowRun builds and placeholder image replacement on a real
      control plane
- [ ] Environment promotion (dev → staging) with per-env config overrides
- [ ] Production DB posture: managed postgres or an operator instead of the
      single-replica trait-backed pod; drop `FHIR_CREATE_TABLES`
- [ ] CSP nonce follow-up from PR #22 applies to `deploy/nginx` config here

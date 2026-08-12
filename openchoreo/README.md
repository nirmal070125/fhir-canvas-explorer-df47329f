# OpenChoreo Deployment

Deploys the FHIR Canvas Explorer onto an [OpenChoreo](https://openchoreo.dev)
data plane (`openchoreo.dev/v1alpha1`).

## Topology

```
internet ── OpenChoreo gateway (Envoy, TLS)
              ▼  external
        explorer-nginx     security headers, rate limiting, reverse proxy
              ▼  project
        explorer-web       Next.js UI + API routes (MCP as a stdio subprocess)
              ▼  project
        wso2-fhir-server   Go FHIR R4 server (wso2/fhir-server), portless Service
              ▼  project
        fhir-postgres      platform-provisioned postgres
```

The project is a cell (namespace); NetworkPolicies come from endpoint
visibility, so only `explorer-nginx` is external. The `backend-only-ingress`
trait narrows `wso2-fhir-server` to `explorer-web` alone.

## Layout

| Path | Purpose |
| --- | --- |
| `project/` `postgres/` | Project + Postgres Resource, each with a dev release binding |
| `nginx/` `web/` `wso2-fhir-server/` | App Components + Workloads |
| `platform/` | Cluster traits + AI gateway (`platform/ai-gateway/`) |
| `setup.sh` | One-shot deploy: platform + app |
| `seed-secrets.sh` | Seeds the OpenAI key into OpenBao |

## Prerequisites

- Tooling via [devbox](https://www.jetify.com/devbox): `devbox shell`, then `devbox run install-occ`.
- An OpenChoreo control plane (getting-started bundle, External Secrets Operator).
- Install with `backstage.auth.oidcScope="openid profile email groups"` — the
  default scope omits `groups`, leaving the portal empty.

## Deploy (development)

```sh
./openchoreo/seed-secrets.sh   # OpenAI key into OpenBao
./openchoreo/setup.sh          # platform + all app components
```

Builds: create a `WorkflowRun` per source-built component; the pipeline wires
the image into the Workload and autoDeploy rolls it out. Promote to other
environments by adding per-env release bindings.

## Platform findings

Validated end to end on a manual k3d install (charts 1.2.2):

- Workloads must be named `<component>-workload` — the build pipeline writes
  that CR; any other name wedges the controller. Checked-in image tags are
  bootstrap values only.
- The stock build template's user-mode networking can't sustain `bun install`;
  patch the ClusterWorkflowTemplate to `podman build --network=host`.
- Workload edits alone don't recut a ComponentRelease — delete the stale one.
- Generated HTTPRoutes carry no timeout (Envoy's 15s cuts off chat) —
  `http-route-timeout` trait.
- Trait `patches:` don't stick to the visibility-generated NetworkPolicy (they
  do on HTTPRoutes), and it uses the Service port not the container port — so
  `backend-only-ingress` `creates:` a second, additive policy instead.
- AI-gateway policy order: `llm-cost` must be listed after `advanced-ratelimit`
  (the response phase runs in reverse) or cost is never charged.

k3d restart quirks: dev-mode OpenBao is in-memory (re-run `seed-secrets.sh`);
CoreDNS drops `host.k3d.internal`, breaking `*.openchoreo.localhost` (portal
login fails); the LB needs host port 8080 free.

## Remaining work

- [ ] Environment promotion (dev → staging) with per-env overrides
- [ ] Production DB: managed postgres, drop `FHIR_CREATE_TABLES`
- [ ] Cost counter on `redis` (memory resets on gateway restart)
- [ ] CSP nonce follow-up from PR #22

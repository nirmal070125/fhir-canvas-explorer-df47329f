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
        wso2-fhir-server   Go FHIR R4 server (wso2/fhir-server)
              ▼  project
        fhir-postgres      platform-provisioned postgres
```

The project is a cell (namespace); NetworkPolicies come from endpoint
visibility, so only `explorer-nginx` is external. Everything else is
`project`-visible — reachable within the cell but not outside it.

## Layout

| Path | Purpose |
| --- | --- |
| `project/` `postgres/` | Project + Postgres Resource, each with a dev release binding |
| `nginx/` `web/` `wso2-fhir-server/` | App Components + Workloads |
| `platform/` | Cluster traits + AI gateway (`platform/ai-gateway/`) |
| `setup.sh` | One-shot deploy: platform + app |

## Prerequisites

- Docker running locally (k3d provisions the cluster inside it).
- Tooling via [devbox](https://www.jetify.com/devbox): `devbox shell` brings in
  kubectl, helm, k3d, and `occ`.
- An OpenChoreo control plane. `devbox run bootstrap-platform` stands one up on
  k3d (control + data + build planes, charts `v1.2.2`, incl. External Secrets
  Operator + OpenBao); or bring your own and skip straight to `setup.sh`.
- If you self-host the portal, install with
  `backstage.auth.oidcScope="openid profile email groups"` — the default scope
  omits `groups`, leaving the portal empty.

## Deploy (development)

One command — provisions the platform, then deploys the app onto it:

```sh
export OPENAI_API_KEY=sk-...   # or put it in the repo-root .env.local
devbox run up                  # bootstrap-platform + ./openchoreo/setup.sh
```

Or run the phases separately (e.g. against a control plane you already have):

```sh
devbox run bootstrap-platform  # k3d cluster + OpenChoreo control/data/build planes (idempotent)
./openchoreo/setup.sh          # seed key + AI gateway + all app components
```

Tear the local cluster down with `devbox run down`.

Builds: each source-built component ships a `WorkflowRun` (applied by
`setup.sh`) that builds the image; the pipeline wires it into the Workload and
autoDeploy rolls it out. Bump the `-01` suffix to rebuild. This deployment uses
a single `development` environment.

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
- Visibility has no finer level than `project` (whole cell); there is no
  built-in "only component X may call Y" (open epic openchoreo#3122), and
  dependencies inject env vars without enforcing any NetworkPolicy.
- AI-gateway policy order: `llm-cost` must be listed after `advanced-ratelimit`
  (the response phase runs in reverse) or cost is never charged.
- `regex-guardrail` is an allowlist by default (blocks when the pattern does *not*
  match); set `invert: true` to use it as a denylist. It also JSON-unescapes `\b`
  to a backspace, so patterns must avoid backslashes (`[^a-z]` for word bounds).
  Guardrail blocks return HTTP 422, not the documented 446.

k3d restart quirks: dev-mode OpenBao is in-memory (re-run `setup.sh`);
CoreDNS drops `host.k3d.internal`, breaking `*.openchoreo.localhost` (portal
login fails); the LB needs host port 8080 free.

## Remaining work

- [ ] Cost counter on `redis` (memory resets on gateway restart)
- [ ] CSP nonce follow-up from PR #22
- [ ] ML-based PII masking via the custom `pii-masking-openmed` policy (currently
  incompatible with `advanced-ratelimit`; ships the built-in regex mask for now)

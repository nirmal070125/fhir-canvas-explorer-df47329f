# OpenChoreo Deployment (WIP)

Deploys the FHIR Canvas Explorer onto an [OpenChoreo](https://openchoreo.dev)
data plane as a reference architecture for running WSO2 Open Healthcare
workloads on a self-managed Kubernetes cluster.

## Status

- [x] Project / component / workload descriptors (high-level)
- [ ] Build pipeline (source-to-image via the existing `Dockerfile`)
- [ ] Secret wiring for `OPENAI_API_KEY` (must NOT be a plain env value)
- [ ] Backing FHIR server (postgres + FHIR R4) as its own component
- [ ] Endpoint exposure / gateway configuration + TLS
- [ ] Environment promotion (dev → staging)

## Layout

| File | Purpose |
| --- | --- |
| `project.yaml` | OpenChoreo Project grouping the explorer components |
| `component.yaml` | The explorer web app component (built from the repo `Dockerfile`) |
| `workload.yaml` | Runtime contract: container, port 8080, env configuration |

## Prerequisites

Everything is provisioned through [devbox](https://www.jetify.com/devbox)
(see `devbox.json` at the repo root):

```sh
devbox shell                     # node, bun, kubectl, helm, kind, jq
devbox run install-choreoctl     # OpenChoreo CLI into .devbox/bin
```

You also need an OpenChoreo control plane reachable from `kubectl` — for
local evaluation, follow the OpenChoreo quick-start to set one up on kind.

## Applying (dev environment)

```sh
kubectl apply -f openchoreo/project.yaml
kubectl apply -f openchoreo/component.yaml
kubectl apply -f openchoreo/workload.yaml
```

> **WIP:** the descriptors deploy the UI shell only. The chat assistant needs
> the `OPENAI_API_KEY` secret mounted, and the app expects a FHIR R4 server —
> point `FHIR_ALLOWED_ORIGINS` at one, or deploy the bundled docker-compose
> stack as a sibling component (TODO).

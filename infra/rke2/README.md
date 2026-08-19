# RKE2 cluster for OpenChoreo (open-cloud-datacenter tenancy)

Terraform for an RKE2 cluster in the `solutions-rnd-oh-demos` tenant space on the
us-dc Harvester datacenter, provisioned through Rancher with the
[wso2/open-cloud-datacenter `k8s-cluster` module](https://github.com/wso2/open-cloud-datacenter/tree/terraform/modules/tenancy/k8s-cluster)
(pinned to `terraform/v0.1.7`). This is phase 1: cluster only. Phase 2 installs
OpenChoreo onto it via the plain Helm charts (notes below).

## Layout

One machine per OpenChoreo plane, selected later via the `openchoreo.dev/plane`
node label each pool sets:

| Pool  | Plane            | Roles                        | CPU | RAM  | Disk  |
|-------|------------------|------------------------------|-----|------|-------|
| oc-cp | control          | control-plane + etcd + worker| 4   | 16Gi | 100Gi |
| oc-dp | data (workloads) | worker                       | 6   | 24Gi | 200Gi |
| oc-wp | build            | worker                       | 6   | 16Gi | 100Gi |

Sized against the tenant quota of 16 CPU / 64Gi / 500Gi: all 16 cores
allocated, with 8Gi RAM and 100Gi storage left as headroom for workload
PersistentVolumes.

The RKE2 control-plane role is co-located on the OpenChoreo control-plane
machine to avoid a fourth VM. Scale a pool by editing `quantity` and
re-applying.

Networks (namespace `solutions-rnd-oh-demos-common`): primary NIC on
`vm-subnet-730` (VLAN 730), storage NIC on
`solutions-rnd-oh-demos-strg-vlan587` (VLAN 587).

## Deploy

Requires Terraform >= 1.7 and a Rancher API token
(Rancher UI -> Account & API Keys).

```bash
cd infra/rke2
cp terraform.tfvars.example terraform.tfvars   # fill in Rancher URL + Harvester cluster
cp secret.tfvars.example secret.tfvars         # fill in token + node password
terraform init
terraform plan -var-file=secret.tfvars
terraform apply -var-file=secret.tfvars
```

Cluster goes `Provisioning` -> `Active` in 10-20 minutes. Download the
kubeconfig from the Rancher UI once Active.

Both `terraform.tfvars` (environment values) and `secret.tfvars` (credentials)
are git-ignored; never commit them.

## Phase 2: OpenChoreo via Helm (follow-up)

The local devbox flow uses the OpenChoreo k3d installer, which creates its own
k3d cluster and cannot target RKE2. On this cluster OpenChoreo installs from
its Helm charts directly, pinned to the same v1.2.2 we run locally:

```bash
helm install openchoreo-control-plane  oci://ghcr.io/openchoreo/helm-charts/openchoreo-control-plane  --version 1.2.2 -n openchoreo-control-plane  --create-namespace -f values-cp.yaml
helm install openchoreo-data-plane     oci://ghcr.io/openchoreo/helm-charts/openchoreo-data-plane     --version 1.2.2 -n openchoreo-data-plane     --create-namespace -f values-dp.yaml
helm install openchoreo-workflow-plane oci://ghcr.io/openchoreo/helm-charts/openchoreo-workflow-plane --version 1.2.2 -n openchoreo-workflow-plane --create-namespace -f values-wp.yaml
```

Known work items for that phase, replacing what the k3d installer provides:

- Values files with nodeSelectors on `openchoreo.dev/plane` to pin each plane
  to its machine.
- An image registry for in-cluster builds (the k3d installer runs a local
  registry container; here it needs an in-cluster registry such as zot, or an
  external one).
- Gateway exposure via ingress-nginx/LoadBalancer on VLAN 730 instead of k3d
  port mappings.
- Re-check the build workarounds from the local setup: the podman
  `--network=host` patch likely still applies; the laptop-specific CoreDNS
  fixes should not.

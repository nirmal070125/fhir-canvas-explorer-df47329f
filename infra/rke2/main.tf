# RKE2 cluster for OpenChoreo: one machine per plane, node-labelled for the
# Helm installs' nodeSelectors (see README.md). RKE2 control-plane role is
# co-located on the OpenChoreo control-plane machine to avoid a fourth VM.
module "openchoreo_rke2" {
  source = "github.com/wso2/open-cloud-datacenter//modules/tenancy/k8s-cluster?ref=terraform/v0.1.7"

  cluster_name       = "oh-demos-openchoreo"
  kubernetes_version = "v1.34.9+rke2r1"

  create_cloud_credential         = true
  enable_harvester_cloud_provider = true
  harvester_cluster_name          = var.harvester_cluster_name
  rancher_api_url                 = var.rancher_api_url
  rancher_api_token               = var.rancher_api_token

  harvester_vm_namespace = local.vm_namespace

  cni                = "cilium"
  ingress_controller = "ingress-nginx"

  node_password       = var.node_password
  ssh_authorized_keys = var.ssh_authorized_keys
  ntp_server          = var.ntp_server
  manage_rke_config   = true

  machine_pools = [
    {
      name            = "oc-cp"
      vm_namespace    = local.vm_namespace
      quantity        = 1
      cpu_count       = "4"
      memory_size     = "16"
      disk_size       = 100
      image_name      = local.image_name
      vm_network      = local.vm_network
      storage_network = local.storage_network
      control_plane   = true
      etcd            = true
      worker          = true
      machine_labels  = { "openchoreo.dev/plane" = "control" }
    },
    {
      name            = "oc-dp"
      vm_namespace    = local.vm_namespace
      quantity        = 1
      cpu_count       = "6"
      memory_size     = "24"
      disk_size       = 200
      image_name      = local.image_name
      vm_network      = local.vm_network
      storage_network = local.storage_network
      control_plane   = false
      etcd            = false
      worker          = true
      machine_labels  = { "openchoreo.dev/plane" = "data" }
    },
    {
      name            = "oc-wp"
      vm_namespace    = local.vm_namespace
      quantity        = 1
      cpu_count       = "6"
      memory_size     = "16"
      disk_size       = 100
      image_name      = local.image_name
      vm_network      = local.vm_network
      storage_network = local.storage_network
      control_plane   = false
      etcd            = false
      worker          = true
      machine_labels  = { "openchoreo.dev/plane" = "build" }
    }
  ]
}

locals {
  vm_namespace    = "solutions-rnd-oh-demos"
  image_name      = "images/ubuntu-24-04"
  vm_network      = "solutions-rnd-oh-demos-common/vm-subnet-730"
  storage_network = "solutions-rnd-oh-demos-common/solutions-rnd-oh-demos-strg-vlan587"
}

output "cluster_id" {
  description = "Rancher v2 cluster ID"
  value       = module.openchoreo_rke2.cluster_id
}

output "cluster_name" {
  description = "Downstream cluster name"
  value       = module.openchoreo_rke2.cluster_name
}

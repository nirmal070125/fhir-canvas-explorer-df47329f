#!/usr/bin/env bash
#
# Deploy the FHIR Canvas Explorer onto an OpenChoreo data plane, end to end:
# seed the OpenAI key, install the WSO2 AI gateway and traits, then apply the
# app components. Idempotent. Requires OPENAI_API_KEY in the environment or in
# the repo-root .env.local / .env.
#
# Usage: ./openchoreo/setup.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/.." && pwd)"
aigw="$here/platform/ai-gateway"
data_plane="openchoreo-data-plane"

log() { printf '\n%s\n' "$*"; }

# Resolve the OpenAI key and write it to OpenBao, where the AI gateway's
# LlmProvider reads it via External Secrets.
seed_openai_key() {
  local key="${OPENAI_API_KEY:-}" file
  if [ -z "$key" ]; then
    for file in "$repo_root/.env.local" "$repo_root/.env"; do
      [ -f "$file" ] && key="$(sed -n 's/^OPENAI_API_KEY=//p' "$file" | tail -1 | tr -d '"')"
      [ -n "$key" ] && break
    done
  fi
  [ -n "$key" ] || { echo "Set OPENAI_API_KEY, or add it to .env.local" >&2; exit 1; }

  local bao_ns="${OPENBAO_NAMESPACE:-openbao}" bao_pod
  bao_pod="$(kubectl get pods -n "$bao_ns" -l app.kubernetes.io/name=openbao \
    -o jsonpath='{.items[0].metadata.name}')"
  printf '%s' "$key" | kubectl exec -i -n "$bao_ns" "$bao_pod" -- \
    bao kv put secret/fhir-canvas-explorer-openai-api-key value=- >/dev/null
}

# Idempotently add a ClusterTrait to a ComponentType's allowlist.
allow_trait() {
  local component_type="$1" trait="$2"
  kubectl get clustercomponenttype "$component_type" \
    -o jsonpath='{.spec.allowedTraits[*].name}' | grep -qw "$trait" && return 0
  kubectl patch clustercomponenttype "$component_type" --type=json \
    -p="[{\"op\":\"add\",\"path\":\"/spec/allowedTraits/-\",\"value\":{\"name\":\"$trait\",\"kind\":\"ClusterTrait\"}}]"
}

# Block until at least one gateway-runtime pod exists, then until it is ready.
wait_for_gateway() {
  until kubectl get pods -n "$data_plane" \
    -l app.kubernetes.io/instance=api-platform-default-gateway -o name 2>/dev/null | grep -q .; do
    sleep 5
  done
  kubectl wait --for=condition=ready pod \
    -l app.kubernetes.io/instance=api-platform-default-gateway -n "$data_plane" --timeout=300s
}

log "Seeding the OpenAI key into OpenBao"
seed_openai_key

log "Platform: gateway client-address policy"
kubectl apply -f "$here/platform/gateway-client-address-policy.yaml"

log "Platform: WSO2 API Platform AI gateway"
helm upgrade --install api-platform-operator \
  oci://ghcr.io/wso2/api-platform/helm-charts/gateway-operator \
  --version 0.8.0 -n "$data_plane" --set gatewayApi.installStandardCRDs=false --wait --timeout 10m
kubectl apply -f "$aigw/gateway-configuration.yaml" -f "$aigw/apigateway.yaml" -f "$aigw/rbac.yaml"
kubectl apply -f "$aigw/provider-auth-external-secret.yaml"
kubectl wait externalsecret/openai-provider-auth -n "$data_plane" --for=condition=Ready --timeout=120s
wait_for_gateway
kubectl apply -f "$aigw/llm-provider.yaml"

log "Platform: traits"
kubectl apply -f "$here/platform/http-route-timeout-trait.yaml" -f "$aigw/ai-user-cost-budget-trait.yaml"
allow_trait service        ai-user-cost-budget
allow_trait web-application http-route-timeout

log "App: components"
kubectl apply -f "$here/project" -f "$here/postgres" \
  -f "$here/wso2-fhir-server" -f "$here/web" -f "$here/nginx"

log "Done. Verify: kubectl get components,workloads -n default"

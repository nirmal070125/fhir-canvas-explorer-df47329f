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

# Read a variable from the environment, falling back to the repo-root .env.
dotenv() {
  local name="$1" val="${!1:-}"
  if [ -z "$val" ] && [ -f "$repo_root/.env" ]; then
    val="$(sed -n "s/^$name=//p" "$repo_root/.env" | tail -1 | tr -d '"')"
  fi
  printf '%s' "$val"
}

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
  for i in $(seq 60); do
    kubectl get pods -n "$data_plane" \
      -l app.kubernetes.io/instance=api-platform-default-gateway -o name 2>/dev/null | grep -q . && break
    [ "$i" -eq 60 ] && { log "gateway-runtime pod did not appear after 5m"; exit 1; }
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
# Seed the control-plane token into the Secret the gateway config references.
controlplane_token="$(dotenv CONTROLPLANE_TOKEN)"
[ -n "$controlplane_token" ] || { echo "Set CONTROLPLANE_TOKEN, or add it to .env" >&2; exit 1; }
kubectl create secret generic gateway-controlplane-token -n "$data_plane" \
  --from-literal=token="$controlplane_token" --dry-run=client -o yaml | kubectl apply -f -

# Render the config, injecting admin/OAuth2 creds from .env (dev defaults otherwise).
export GATEWAY_ADMIN_PASSWORD="$(dotenv GATEWAY_ADMIN_PASSWORD)"; : "${GATEWAY_ADMIN_PASSWORD:=admin}"
export APIM_OAUTH2_CLIENT_ID="$(dotenv APIM_OAUTH2_CLIENT_ID)"; : "${APIM_OAUTH2_CLIENT_ID:=l2kngtY9ddhP840SwfPw2SP3KUYa}"
export APIM_OAUTH2_CLIENT_SECRET="$(dotenv APIM_OAUTH2_CLIENT_SECRET)"; : "${APIM_OAUTH2_CLIENT_SECRET:=y4onq2NR7Uli1sydgMePcIbQ4Ywa}"
export APIM_OAUTH2_PASSWORD="$(dotenv APIM_OAUTH2_PASSWORD)"; : "${APIM_OAUTH2_PASSWORD:=admin}"
envsubst '$GATEWAY_ADMIN_PASSWORD $APIM_OAUTH2_CLIENT_ID $APIM_OAUTH2_CLIENT_SECRET $APIM_OAUTH2_PASSWORD' \
  < "$aigw/gateway-configuration.yaml" | kubectl apply -f -
kubectl apply -f "$aigw/apigateway.yaml" -f "$aigw/rbac.yaml"
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

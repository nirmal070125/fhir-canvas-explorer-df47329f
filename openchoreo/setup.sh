#!/bin/bash
# One-shot platform setup for the FHIR Canvas Explorer on an OpenChoreo data
# plane: gateway client-address policy plus the WSO2 API Platform AI gateway
# (operator, gateway instance, shared LLM provider, traits). Idempotent.
# Requires the OpenAI key in OpenBao first: ./openchoreo/seed-secrets.sh
# Usage: ./openchoreo/setup.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
ns=openchoreo-data-plane
aigw="$here/platform/ai-gateway"

# Trustworthy client addresses at the gateway (rate limiter depends on this).
kubectl apply -f "$here/platform/gateway-client-address-policy.yaml"

# WSO2 API Platform operator.
helm upgrade --install api-platform-operator \
  oci://ghcr.io/wso2/api-platform/helm-charts/gateway-operator \
  --version 0.8.0 -n "$ns" \
  --set gatewayApi.installStandardCRDs=false \
  --wait --timeout 10m

# Gateway runtime config (vendored upstream, see upstream/README.md) + instance.
kubectl apply -f "$aigw/upstream/gateway-configuration.yaml"
kubectl apply -f "$aigw/apigateway.yaml"
kubectl apply -f "$aigw/rbac.yaml"

# Provider credential from OpenBao, then the shared provider.
kubectl apply -f "$aigw/provider-auth-external-secret.yaml"
kubectl wait externalsecret/openai-provider-auth -n "$ns" --for=condition=Ready --timeout=120s

echo "Waiting for the gateway runtime..."
until [ -n "$(kubectl get pods -n "$ns" -l app.kubernetes.io/instance=api-platform-default-gateway -o name 2>/dev/null)" ]; do sleep 5; done
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/instance=api-platform-default-gateway -n "$ns" --timeout=300s

kubectl apply -f "$aigw/upstream/llm-provider.yaml"

# Traits. ai-token-cost-control is the single LLM trait (passthrough + cost
# tracking); backend-only-ingress whitelists wso2-fhir-server to explorer-web.
kubectl apply -f "$here/platform/http-route-timeout-trait.yaml"
kubectl apply -f "$here/platform/backend-only-ingress-trait.yaml"
kubectl apply -f "$aigw/upstream/ai-token-cost-control-trait.yaml"
for trait in ai-token-cost-control backend-only-ingress; do
  if ! kubectl get clustercomponenttype service -o jsonpath='{.spec.allowedTraits[*].name}' | grep -qw "$trait"; then
    kubectl patch clustercomponenttype service --type='json' \
      -p='[{"op": "add", "path": "/spec/allowedTraits/-", "value": {"name": "'"$trait"'", "kind": "ClusterTrait"}}]'
  fi
done
if ! kubectl get clustercomponenttype web-application -o jsonpath='{.spec.allowedTraits[*].name}' | grep -qw http-route-timeout; then
  kubectl patch clustercomponenttype web-application --type='json' \
    -p='[{"op": "add", "path": "/spec/allowedTraits/-", "value": {"name": "http-route-timeout", "kind": "ClusterTrait"}}]'
fi

echo "Done. Verify: kubectl get llmprovider -n $ns openai-provider"

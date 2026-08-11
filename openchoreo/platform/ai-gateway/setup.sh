#!/bin/bash
# Installs the WSO2 API Platform AI gateway into the data plane and wires the
# ai-llm-proxy trait so components can route LLM traffic through it.
# Idempotent; safe to re-run. Requires the OpenAI key in OpenBao
# (./openchoreo/seed-secrets.sh seeds it).
# Usage: ./openchoreo/platform/ai-gateway/setup.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
ns=openchoreo-data-plane
module_ref=c365d3ab68dab91c9b0b0780ab908ed1136b1172

helm upgrade --install api-platform-operator \
  oci://ghcr.io/wso2/api-platform/helm-charts/gateway-operator \
  --version 0.8.0 -n "$ns" \
  --set gatewayApi.installStandardCRDs=false \
  --wait --timeout 10m

# Upstream module files, unmodified and pinned by commit.
module_url="https://raw.githubusercontent.com/openchoreo/community-modules/$module_ref/ai-gateway-wso2-api-platform"
kubectl apply -f "$module_url/gateway-configuration.yaml"
kubectl apply -f "$here/apigateway.yaml"
kubectl apply -f "$here/rbac.yaml"

# Provider credential from OpenBao, then the shared provider.
kubectl apply -f "$here/provider-auth-external-secret.yaml"
kubectl wait externalsecret/openai-provider-auth -n "$ns" --for=condition=Ready --timeout=120s

echo "Waiting for the gateway runtime..."
until [ -n "$(kubectl get pods -n "$ns" -l app.kubernetes.io/instance=api-platform-default-gateway -o name 2>/dev/null)" ]; do sleep 5; done
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/instance=api-platform-default-gateway -n "$ns" --timeout=300s

kubectl apply -f "$module_url/llm-provider.yaml"

# Traits, allowed on the service component type. ai-token-cost-control is the
# one in use (passthrough + cost tracking); ai-llm-proxy stays available.
for trait in ai-llm-proxy ai-token-cost-control; do
  kubectl apply -f "$module_url/$trait-trait.yaml"
  if ! kubectl get clustercomponenttype service -o jsonpath='{.spec.allowedTraits[*].name}' | grep -qw "$trait"; then
    kubectl patch clustercomponenttype service --type='json' \
      -p='[{"op": "add", "path": "/spec/allowedTraits/-", "value": {"name": "'"$trait"'", "kind": "ClusterTrait"}}]'
  fi
done

echo "Done. Verify: kubectl get llmprovider -n $ns openai-provider"

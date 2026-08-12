#!/bin/bash
# One-shot deploy of the FHIR Canvas Explorer on an OpenChoreo data plane:
# platform (AI gateway + traits) then the app components. Idempotent.
# Prereq: ./openchoreo/seed-secrets.sh (OpenAI key into OpenBao).
# Usage: ./openchoreo/setup.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
ns=openchoreo-data-plane
aigw="$here/platform/ai-gateway"

# allow_trait <componentType> <trait>: add a trait to a ComponentType allowlist.
allow_trait() {
  kubectl get clustercomponenttype "$1" -o jsonpath='{.spec.allowedTraits[*].name}' | grep -qw "$2" && return 0
  kubectl patch clustercomponenttype "$1" --type=json \
    -p="[{\"op\":\"add\",\"path\":\"/spec/allowedTraits/-\",\"value\":{\"name\":\"$2\",\"kind\":\"ClusterTrait\"}}]"
}

echo "== Platform: gateway client-address policy =="
kubectl apply -f "$here/platform/gateway-client-address-policy.yaml"

echo "== Platform: WSO2 API Platform AI gateway =="
helm upgrade --install api-platform-operator \
  oci://ghcr.io/wso2/api-platform/helm-charts/gateway-operator \
  --version 0.8.0 -n "$ns" --set gatewayApi.installStandardCRDs=false --wait --timeout 10m
kubectl apply -f "$aigw/gateway-configuration.yaml" -f "$aigw/apigateway.yaml" -f "$aigw/rbac.yaml"
kubectl apply -f "$aigw/provider-auth-external-secret.yaml"
kubectl wait externalsecret/openai-provider-auth -n "$ns" --for=condition=Ready --timeout=120s
echo "   waiting for the gateway runtime..."
until [ -n "$(kubectl get pods -n "$ns" -l app.kubernetes.io/instance=api-platform-default-gateway -o name 2>/dev/null)" ]; do sleep 5; done
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=api-platform-default-gateway -n "$ns" --timeout=300s
kubectl apply -f "$aigw/llm-provider.yaml"

echo "== Platform: traits =="
kubectl apply -f "$here/platform/http-route-timeout-trait.yaml" \
  -f "$here/platform/backend-only-ingress-trait.yaml" \
  -f "$aigw/ai-user-cost-budget-trait.yaml"
allow_trait service        ai-user-cost-budget
allow_trait service        backend-only-ingress
allow_trait web-application http-route-timeout

echo "== App: components =="
kubectl apply -f "$here/project" -f "$here/postgres" \
  -f "$here/wso2-fhir-server" -f "$here/web" -f "$here/nginx"

echo "Done. Verify: kubectl get components,workloads -n default"

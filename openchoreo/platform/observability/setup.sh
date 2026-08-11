#!/bin/bash
# Installs the OpenChoreo observability plane plus the OpenSearch logs module
# (Fluent Bit collection) on a single-cluster k3d install, and registers the
# plane with the control plane. Idempotent; safe to re-run.
# Usage: ./openchoreo/platform/observability/setup.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
ns=openchoreo-observability-plane

kubectl create ns "$ns" --dry-run=client -o yaml | kubectl apply -f -

# Observer's OAuth client secret (quickstart Thunder dev fixture).
kubectl create secret generic observer-secrets -n "$ns" \
  --from-literal=UID_RESOLVER_OAUTH_CLIENT_SECRET=openchoreo-observer-resource-reader-client-secret \
  --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install openchoreo-observability-plane \
  oci://ghcr.io/openchoreo/helm-charts/openchoreo-observability-plane \
  --version 1.2.2 -n "$ns" -f "$here/plane-values.yaml" \
  --set observer.secretName=observer-secrets \
  --wait --timeout 15m

# OpenSearch admin credentials: generate once, keep in OpenBao.
bao_ns="${OPENBAO_NAMESPACE:-openbao}"
bao_pod="$(kubectl get pods -n "$bao_ns" -l app.kubernetes.io/name=openbao \
  -o jsonpath='{.items[0].metadata.name}')"
if ! kubectl exec -n "$bao_ns" "$bao_pod" -- bao kv get secret/opensearch-password >/dev/null 2>&1; then
  pass="$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 20)"
  printf 'admin' | kubectl exec -i -n "$bao_ns" "$bao_pod" -- bao kv put secret/opensearch-username value=- >/dev/null
  printf '%s' "$pass" | kubectl exec -i -n "$bao_ns" "$bao_pod" -- bao kv put secret/opensearch-password value=- >/dev/null
  echo "Seeded opensearch credentials in OpenBao"
fi
kubectl apply -f "$here/opensearch-credentials-external-secret.yaml"
kubectl wait "externalsecret/opensearch-admin-credentials" -n "$ns" --for=condition=Ready --timeout=120s
os_pass="$(kubectl get secret opensearch-admin-credentials -n "$ns" -o jsonpath='{.data.password}' | base64 -d)"

helm upgrade --install observability-logs-opensearch \
  oci://ghcr.io/openchoreo/helm-charts/observability-logs-opensearch \
  --version 0.5.3 -n "$ns" -f "$here/logs-module-values.yaml" \
  --set "openSearch.extraEnvs[0].name=OPENSEARCH_INITIAL_ADMIN_PASSWORD" \
  --set "openSearch.extraEnvs[0].value=$os_pass" \
  --wait --timeout 15m

# The plane's cluster agent needs the control-plane gateway CA; the data-plane
# install already carries it.
kubectl get cm cluster-gateway-ca -n openchoreo-data-plane -o json \
  | jq 'del(.metadata) | .metadata={name:"cluster-gateway-ca",namespace:"'"$ns"'"}' \
  | kubectl apply -f -

# Register with the control plane. A ClusterObservabilityPlane named "default"
# is auto-discovered by every data/workflow plane.
ca="$(kubectl get secret cluster-agent-tls -n "$ns" -o jsonpath='{.data.ca\.crt}' | base64 -d)"
kubectl apply -f - <<EOF
apiVersion: openchoreo.dev/v1alpha1
kind: ClusterObservabilityPlane
metadata:
  name: default
spec:
  planeID: default
  observerURL: http://observer.$ns.svc.cluster.local:8080
  clusterAgent:
    clientCA:
      value: |
$(echo "$ca" | sed 's/^/        /')
EOF

echo "Done. Verify: kubectl get clusterobservabilityplane default -o jsonpath='{.status.agentConnection.connected}'"

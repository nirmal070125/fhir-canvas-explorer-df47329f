#!/bin/bash
# Seeds the OpenBao entries that secrets.yaml references, from environment
# variables, then restarts the consuming pods so they pick up the new values.
# Usage: OPENAI_API_KEY=sk-... ./openchoreo/seed-secrets.sh
set -euo pipefail

: "${OPENAI_API_KEY:?Set OPENAI_API_KEY in the environment (e.g. export it or prefix the command)}"

kubectl exec -n openbao openbao-0 -- \
  bao kv put secret/fhir-canvas-explorer-openai-api-key value="$OPENAI_API_KEY" >/dev/null
echo "Seeded secret/fhir-canvas-explorer-openai-api-key"

for ns in $(kubectl get ns -o name | sed 's|namespace/||' | grep '^dp-default-fhir-canvas-e-'); do
  kubectl delete pod -n "$ns" -l openchoreo.dev/component=explorer-web --ignore-not-found
done
echo "explorer-web restarted; the Deployment recreates it with the new secret"

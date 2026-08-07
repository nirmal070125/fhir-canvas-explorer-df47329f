#!/bin/bash
# Seeds the OpenBao entries that secrets.yaml references, then restarts the
# consuming pods. Values come from the environment, or from .env.local / .env
# at the repo root (copy .env.example to get started).
# Usage: ./openchoreo/seed-secrets.sh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${OPENAI_API_KEY:-}" ]; then
  for f in "$repo_root/.env.local" "$repo_root/.env"; do
    if [ -f "$f" ]; then
      set -a; . "$f"; set +a
      break
    fi
  done
fi

: "${OPENAI_API_KEY:?Set OPENAI_API_KEY, or fill it in .env.local (see .env.example)}"

kubectl exec -n openbao openbao-0 -- \
  bao kv put secret/fhir-canvas-explorer-openai-api-key value="$OPENAI_API_KEY" >/dev/null
echo "Seeded secret/fhir-canvas-explorer-openai-api-key"

for ns in $(kubectl get ns -o name | sed 's|namespace/||' | grep '^dp-default-fhir-canvas-e-'); do
  kubectl delete pod -n "$ns" -l openchoreo.dev/component=explorer-web --ignore-not-found
done
echo "explorer-web restarted; the Deployment recreates it with the new secret"

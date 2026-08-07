#!/bin/bash
# Seeds the OpenBao entries that the SecretReferences use, then restarts the
# consuming pods. Values come from the environment, or OPENAI_API_KEY is read
# from .env.local / .env at the repo root (copy .env.example to get started).
# Usage: ./openchoreo/seed-secrets.sh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${OPENAI_API_KEY:-}" ]; then
  for f in "$repo_root/.env.local" "$repo_root/.env"; do
    if [ -f "$f" ]; then
      OPENAI_API_KEY="$(sed -n 's/^OPENAI_API_KEY=//p' "$f" | tail -1 | tr -d '"')"
      [ -n "$OPENAI_API_KEY" ] && break
    fi
  done
fi
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY, or fill it in .env.local (see .env.example)}"

bao_ns="${OPENBAO_NAMESPACE:-openbao}"
bao_pod="$(kubectl get pods -n "$bao_ns" -l app.kubernetes.io/name=openbao \
  -o jsonpath='{.items[0].metadata.name}')"

# value=- makes bao read the secret from stdin, keeping it out of argv.
printf '%s' "$OPENAI_API_KEY" | kubectl exec -i -n "$bao_ns" "$bao_pod" -- \
  bao kv put secret/fhir-canvas-explorer-openai-api-key value=- >/dev/null
echo "Seeded secret/fhir-canvas-explorer-openai-api-key via $bao_ns/$bao_pod"

restarted=0
for ns in $(kubectl get ns -l openchoreo.dev/project=fhir-canvas-explorer \
  -o jsonpath='{.items[*].metadata.name}'); do
  if kubectl delete pod -n "$ns" -l openchoreo.dev/component=explorer-web \
    --ignore-not-found 2>/dev/null | grep -q deleted; then
    restarted=1
  fi
done
if [ "$restarted" = 1 ]; then
  echo "explorer-web restarted; the Deployment recreates it with the new secret"
else
  echo "No explorer-web pods found to restart (not deployed yet?)"
fi

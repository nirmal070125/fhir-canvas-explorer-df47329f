#!/bin/bash
# Seeds the OpenAI API key into OpenBao, where the AI gateway's LlmProvider
# reads it (via External Secrets). Key comes from $OPENAI_API_KEY or the repo
# root .env.local / .env. Run before ./openchoreo/setup.sh.
# Usage: ./openchoreo/seed-secrets.sh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve the key: env var, else .env.local / .env.
if [ -z "${OPENAI_API_KEY:-}" ]; then
  for f in "$repo_root/.env.local" "$repo_root/.env"; do
    [ -f "$f" ] && OPENAI_API_KEY="$(sed -n 's/^OPENAI_API_KEY=//p' "$f" | tail -1 | tr -d '"')"
    [ -n "${OPENAI_API_KEY:-}" ] && break
  done
fi
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY, or add it to .env.local}"

# Write it into OpenBao (value=- reads stdin, keeping the key out of argv).
bao_ns="${OPENBAO_NAMESPACE:-openbao}"
bao_pod="$(kubectl get pods -n "$bao_ns" -l app.kubernetes.io/name=openbao \
  -o jsonpath='{.items[0].metadata.name}')"
printf '%s' "$OPENAI_API_KEY" | kubectl exec -i -n "$bao_ns" "$bao_pod" -- \
  bao kv put secret/fhir-canvas-explorer-openai-api-key value=- >/dev/null

echo "Seeded the OpenAI key into OpenBao ($bao_ns/$bao_pod)."

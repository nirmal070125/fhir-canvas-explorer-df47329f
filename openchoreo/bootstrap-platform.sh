#!/usr/bin/env bash
#
# Stand up the OpenChoreo platform on a local k3d cluster: control, data, and
# build planes via the pinned release-v1.2 installer. Idempotent — the
# installer self-skips completed steps, so partial runs resume.
#
# Usage: ./openchoreo/bootstrap-platform.sh (or: devbox run bootstrap-platform)
set -euo pipefail

# The chart's default liveness probe kills Backstage before its init finishes,
# which times out the installer's `kubectl wait --all`; relax it as soon as
# the deployment appears so the installer completes in one pass.
backstage_probe_patch='[
  {"op":"replace","path":"/spec/template/spec/containers/0/livenessProbe/initialDelaySeconds","value":180},
  {"op":"replace","path":"/spec/template/spec/containers/0/livenessProbe/failureThreshold","value":30},
  {"op":"replace","path":"/spec/template/spec/containers/0/livenessProbe/timeoutSeconds","value":5}
]'

relax_backstage_probe() {
  kubectl -n openchoreo-control-plane patch deploy backstage \
    --type=json -p "$backstage_probe_patch" >/dev/null 2>&1
}

echo 'Watching to relax Backstage liveness probe (its init outruns the chart default and would time out the installer)…'
(
  for _ in $(seq 1 180); do
    relax_backstage_probe && { echo 'Backstage probe relaxed.'; break; }
    sleep 5
  done
) &

echo 'Installing OpenChoreo (control + data + build planes) on k3d…'
curl -fsSL https://raw.githubusercontent.com/openchoreo/openchoreo/release-v1.2/install/k3d/k3d-install.sh \
  | bash -s -- --version v1.2.2 --with-build
kubectl wait -n openchoreo-control-plane --for=condition=available --timeout=600s deployment --all

echo 'Setting Backstage OIDC scope (openid profile email groups)…'
helm upgrade openchoreo-control-plane \
  oci://ghcr.io/openchoreo/helm-charts/openchoreo-control-plane \
  --version 1.2.2 --namespace openchoreo-control-plane \
  --reuse-values --set backstage.auth.oidcScope='openid profile email groups' >/dev/null

# The upgrade re-renders the deployment; re-apply the probe patch. Backstage
# is the portal only and must never gate component deploys, so non-fatal.
relax_backstage_probe || true
kubectl -n openchoreo-control-plane rollout status deploy/backstage --timeout=300s \
  || echo 'Backstage still settling (portal only — does not block deploys).'
echo 'Control plane ready.'

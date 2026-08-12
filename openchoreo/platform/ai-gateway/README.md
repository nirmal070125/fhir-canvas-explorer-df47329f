# WSO2 API Platform AI Gateway

Routes the chatbot's LLM traffic through the
[WSO2 API Platform AI gateway module](https://openchoreo.dev/ecosystem/item/wso2-api-platform-ai-gateway/)
instead of calling OpenAI directly. Traffic is east-west: the
`ai-token-cost-control` trait on `explorer-web` injects `OPENAI_BASE_URL`
pointing at the in-cluster gateway, which forwards to OpenAI with the
platform-managed credential and tracks per-request cost. The app no longer
holds the API key.

Files in this directory come from two places:

- **Vendored verbatim** from
  [community-modules@c365d3a](https://github.com/openchoreo/community-modules/tree/c365d3ab68dab91c9b0b0780ab908ed1136b1172/ai-gateway-wso2-api-platform)
  (Apache 2.0), unmodified — do not edit; to update, re-copy from a newer
  upstream commit and record it here:
  `gateway-configuration.yaml`, `llm-provider.yaml`,
  `ai-token-cost-control-trait.yaml`.
- **Authored here**, transcribing the module README's inline install steps
  (`apigateway.yaml`, `rbac.yaml`) or taking its suggested ESO/OpenBao option
  for the provider credential (`provider-auth-external-secret.yaml`).

The path-convention gap is bridged in the app: the module injects a host-root
`OPENAI_BASE_URL` and allowlists `/v1/chat/completions`, while the AI SDK
expects a `/v1` base and defaults to `/responses` — so
`src/app/api/chat/route.ts` appends `/v1` when missing and pins the
chat-completions API via `openai.chat()`.

## Install (once per data plane)

```sh
./openchoreo/seed-secrets.sh   # OpenAI key into OpenBao first
./openchoreo/setup.sh          # idempotent; installs everything here
```

`web/component.yaml` attaches the trait; the injected env wins over the
workload's envFrom values, so no workload change is needed for the base URL.

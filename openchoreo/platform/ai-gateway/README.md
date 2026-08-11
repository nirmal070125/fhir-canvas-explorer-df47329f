# WSO2 API Platform AI Gateway

Routes the chatbot's LLM traffic through the
[WSO2 API Platform AI gateway module](https://openchoreo.dev/ecosystem/item/wso2-api-platform-ai-gateway/)
instead of calling OpenAI directly. Traffic is east-west: the `ai-llm-proxy`
trait on `explorer-web` injects `OPENAI_BASE_URL` pointing at the in-cluster
gateway, which forwards to OpenAI with the platform-managed credential. The
app no longer holds the API key.

Files here are vendored from
[community-modules@c365d3a](https://github.com/openchoreo/community-modules/tree/c365d3ab68dab91c9b0b0780ab908ed1136b1172/ai-gateway-wso2-api-platform)
with two deviations, both commented in place:

- `ai-llm-proxy-trait.yaml` appends `/v1` to the injected `OPENAI_BASE_URL`
  (the AI SDK treats the base URL as including `/v1`).
- `llm-provider.yaml` also allows `POST /v1/responses` (the AI SDK's default
  OpenAI API).

## Install (once per data plane)

```sh
./openchoreo/seed-secrets.sh                # OpenAI key into OpenBao first
./openchoreo/platform/ai-gateway/setup.sh   # idempotent
```

The script installs the operator (helm), applies the pinned upstream gateway
configuration, creates the `APIGateway` instance, the RBAC for LlmProxies, the
provider credential (ExternalSecret from OpenBao), the shared `LlmProvider`,
and the trait (allowed on the `service` component type).

`web/component.yaml` attaches the trait; the injected env wins over the
workload's envFrom values, so no workload change is needed for the base URL.

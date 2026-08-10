# FHIR Canvas Explorer

Browser UI for exploring any FHIR R4 server, with a read-only AI assistant
that answers questions by calling FHIR tools through a local model — no API
keys, no cloud, CPU-only.

## Getting started

Requires Docker with the compose plugin.

```sh
docker compose up -d --build
```

The first start builds the images and downloads the model (~530 MB) into a
volume. Then:

- Explorer UI: http://localhost:18080
- FHIR server: http://localhost:18090/fhir/r4
- Model server (llama.cpp, OpenAI-compatible): http://localhost:18081/v1

Load some sample data:

```sh
for f in public/sample-data/{infra-hospitals,infra-practitioners,patient-01,patient-02,patient-03}.json; do
  curl -s -X POST http://localhost:18090/fhir/r4 \
    -H "Content-Type: application/fhir+json" --data-binary @$f > /dev/null
done
```

Open the UI and ask the assistant things like "How many Patient resources
does this server have?" — the first answer pays a cold-cache cost (~30s on
an 8-core laptop), later ones are faster.

## Stack

| Service | What it is |
| --- | --- |
| `explorer` | Next.js UI + API routes + embedded FHIR MCP subprocess, behind nginx |
| `llama` | llama.cpp serving Qwen3.5-0.8B (Q4_K_M) with tool calling |
| `fhir-server` | [wso2/fhir-server](https://github.com/wso2/fhir-server) built from source |
| `db` | postgres backing the FHIR server |

Swap the model by changing the `-hf` tag and `--alias` in
`docker-compose.yml` plus `OPENAI_MODEL`; any GGUF with tool calling works,
and larger models (e.g. Qwen3.5-4B) answer better on faster hardware.

## Development

```sh
bun install
bun run dev        # UI against the compose FHIR server
bun run test       # vitest
bunx tsc --noEmit  # typecheck
```

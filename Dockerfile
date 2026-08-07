FROM oven/bun:1.3.14-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
# In-cluster builds run under user-mode networking (podman/pasta) that drops
# connections under load; low concurrency plus retries rides it out, and bun's
# download cache keeps each retry's progress.
RUN for i in 1 2 3 4 5; do \
      bun install --frozen-lockfile --network-concurrency 8 && break; \
      [ "$i" = 5 ] && exit 1; sleep 5; \
    done

FROM dependencies AS builder
COPY . .
RUN bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV FHIR_MCP_COMMAND=fhir-mcp-server
ENV FHIR_MCP_ARGS="--transport stdio"
ENV FHIR_MCP_IDLE_TTL_MS=300000

RUN apk add --no-cache ca-certificates libstdc++
COPY --from=ghcr.io/astral-sh/uv:0.8.14 /uv /uvx /usr/local/bin/
RUN UV_TOOL_DIR=/opt/uv-tools UV_TOOL_BIN_DIR=/usr/local/bin \
    uv tool install fhir-mcp-server==0.10.0

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { ToolSet } from "ai";

const READ_ONLY_TOOL_NAMES = ["get_capabilities", "search", "read"] as const;
const DEFAULT_IDLE_TTL_MS = 5 * 60 * 1000;

interface CachedMcpClient {
  client: MCPClient;
  tools: ToolSet;
  activeRequests: number;
  idleTimer?: NodeJS.Timeout;
}

const globalMcpCache = globalThis as typeof globalThis & {
  __fhirMcpClients?: Map<string, Promise<CachedMcpClient>>;
};

const clients =
  globalMcpCache.__fhirMcpClients ??
  (globalMcpCache.__fhirMcpClients = new Map<string, Promise<CachedMcpClient>>());

function idleTtlMs(): number {
  const configured = Number(process.env.FHIR_MCP_IDLE_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_IDLE_TTL_MS;
}

function commandConfig() {
  const command = process.env.FHIR_MCP_COMMAND?.trim() || "uvx";
  const args = process.env.FHIR_MCP_ARGS?.trim()
    ? process.env.FHIR_MCP_ARGS.trim().split(/\s+/)
    : ["--from", "fhir-mcp-server==0.10.0", "fhir-mcp-server", "--transport", "stdio"];

  return { command, args };
}

async function createCachedClient(baseUrl: string): Promise<CachedMcpClient> {
  const { command, args } = commandConfig();
  const transport = new Experimental_StdioMCPTransport({
    command,
    args,
    env: {
      FHIR_SERVER_BASE_URL: baseUrl,
      FHIR_SERVER_DISABLE_AUTHORIZATION: "True",
      FHIR_MCP_REQUEST_TIMEOUT: process.env.FHIR_MCP_REQUEST_TIMEOUT ?? "30",
    },
  });

  const client = await createMCPClient({ transport });

  try {
    const availableTools = await client.tools();
    const tools: ToolSet = {};

    for (const name of READ_ONLY_TOOL_NAMES) {
      const tool = availableTools[name];
      if (!tool) {
        throw new Error(`WSO2 FHIR MCP Server did not expose the required '${name}' tool.`);
      }
      tools[name] = tool;
    }

    return { client, tools, activeRequests: 0 };
  } catch (error) {
    await client.close();
    throw error;
  }
}

export async function acquireReadOnlyFhirMcpClient(baseUrl: string): Promise<{
  client: MCPClient;
  tools: ToolSet;
  release: () => void;
}> {
  let pendingClient = clients.get(baseUrl);
  if (!pendingClient) {
    pendingClient = createCachedClient(baseUrl);
    clients.set(baseUrl, pendingClient);
    pendingClient.catch(() => clients.delete(baseUrl));
  }

  const cached = await pendingClient;
  if (cached.idleTimer) {
    clearTimeout(cached.idleTimer);
    cached.idleTimer = undefined;
  }
  cached.activeRequests += 1;

  let released = false;
  return {
    client: cached.client,
    tools: cached.tools,
    release: () => {
      if (released) return;
      released = true;
      cached.activeRequests = Math.max(0, cached.activeRequests - 1);
      if (cached.activeRequests > 0) return;

      cached.idleTimer = setTimeout(() => {
        if (cached.activeRequests > 0) return;
        if (clients.get(baseUrl) === pendingClient) {
          clients.delete(baseUrl);
        }
        void cached.client.close();
      }, idleTtlMs());
      cached.idleTimer.unref();
    },
  };
}

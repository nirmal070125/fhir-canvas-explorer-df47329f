import { openai } from "@ai-sdk/openai";
import { createAgentUIStreamResponse, stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import type { FhirChatMessageMetadata } from "@/lib/fhir-chat-types";
import { acquireReadOnlyFhirMcpClient } from "@/lib/server/fhir-mcp";
import { resolveFhirTarget } from "@/lib/server/fhir-target";

export const runtime = "nodejs";
export const maxDuration = 60;

interface FhirChatRequestBody {
  messages?: UIMessage[];
  baseUrl?: unknown;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "The chatbot is not configured. Set OPENAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  let body: FhirChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "At least one chat message is required." }, { status: 400 });
  }
  let fhirBaseUrl: string;
  try {
    fhirBaseUrl = await resolveFhirTarget(body.baseUrl);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid FHIR base URL." },
      { status: 400 },
    );
  }

  let mcp: Awaited<ReturnType<typeof acquireReadOnlyFhirMcpClient>> | undefined;
  try {
    mcp = await acquireReadOnlyFhirMcpClient(fhirBaseUrl);
    const startedAt = Date.now();
    let fhirCalls = 0;

    const agent = new ToolLoopAgent({
      id: "fhir-explorer-read-only-agent",
      model: openai(process.env.OPENAI_MODEL?.trim() || "gpt-5-nano"),
      tools: mcp.tools,
      stopWhen: stepCountIs(6),
      instructions: [
        "You are the read-only assistant inside a FHIR R4 Explorer.",
        `The selected FHIR server is ${fhirBaseUrl}.`,
        "Use the WSO2 FHIR MCP tools to answer questions about this server.",
        "You may only inspect capabilities, search resources, and read resources.",
        "Never claim to create, update, patch, or delete FHIR data.",
        "Call get_capabilities before searching or reading a resource type.",
        "Do not call get_capabilities for several resource types merely to produce examples or answer a broad question.",
        "If a broad question would require checking many resource types, explain that capabilities are checked per resource type and ask the user which type to inspect.",
        "Write every answer as concise GitHub-flavored Markdown.",
        "Use short headings, lists, tables, links, and inline code when they improve clarity; never wrap the entire answer in a code fence.",
        "Keep normal answers under 120 words unless the user explicitly asks for detail.",
        "Keep tables to at most five rows and three columns.",
        "For capability summaries, report counts and at most three useful examples instead of listing every search parameter, operation, interaction, include, or reverse include.",
        "Identify the resource type and IDs used, and say when the server returned no data.",
        "Do not provide medical diagnosis or treatment advice. Treat returned clinical data as sensitive.",
      ].join("\n"),
    });

    const release = mcp.release;
    request.signal.addEventListener("abort", release, { once: true });

    return await createAgentUIStreamResponse({
      agent,
      uiMessages: body.messages,
      abortSignal: request.signal,
      onStepFinish: ({ toolCalls }) => {
        fhirCalls += toolCalls.length;
      },
      messageMetadata: ({ part }): FhirChatMessageMetadata | undefined => {
        if (part.type !== "finish") return undefined;
        return {
          elapsedMs: Date.now() - startedAt,
          fhirCalls,
          inputTokens: part.totalUsage.inputTokens,
          outputTokens: part.totalUsage.outputTokens,
          totalTokens: part.totalUsage.totalTokens,
        };
      },
      onFinish: release,
      onError: (error) => {
        console.error("FHIR chat stream failed:", error instanceof Error ? error.message : error);
        return "The FHIR assistant could not complete this request.";
      },
    });
  } catch (error) {
    mcp?.release();
    console.error("FHIR chat request failed:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "The FHIR assistant could not connect or complete this request." },
      { status: 502 },
    );
  }
}

import { createOpenAI } from "@ai-sdk/openai";
import { createAgentUIStreamResponse, stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import type { FhirChatMessageMetadata } from "@/lib/fhir-chat-types";
import { acquireReadOnlyFhirMcpClient } from "@/lib/server/fhir-mcp";
import { resolveFhirTarget } from "@/lib/server/fhir-target";
import { clientKey, isRateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// The chatbot runs against a local OpenAI-compatible model server
// (llama.cpp's llama-server) addressed by OPENAI_BASE_URL; no API key.
const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
  apiKey: "none",
});

// Each request can spend up to 6 LLM tool-loop steps, so cap per client IP.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

interface FhirChatRequestBody {
  messages?: UIMessage[];
  baseUrl?: unknown;
}

export async function POST(request: Request) {
  if (isRateLimited(clientKey(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  if (!process.env.OPENAI_BASE_URL) {
    return Response.json(
      { error: "The chatbot is not configured. Set OPENAI_BASE_URL on the server." },
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
      model: openai.chat(process.env.OPENAI_MODEL?.trim() || "qwen3.5-0.8b"),
      tools: mcp.tools,
      stopWhen: stepCountIs(6),
      // Near-zero temperature and a worked example: at small model sizes,
      // deterministic sampling and behavioral examples beat rule prose.
      temperature: 0.1,
      instructions: [
        "You are the read-only assistant inside a FHIR R4 Explorer.",
        `FHIR server: ${fhirBaseUrl}.`,
        "Answer every question by calling a tool first, then state only facts the tool returned.",
        "Tool choice: search for any question about resource data; get_capabilities only when asked what the server supports; read only for a known id.",
        'Counting example: "How many Patient resources are there?" -> call search with {"type":"Patient","searchParam":{"_summary":"count"}} -> the answer is Bundle.total.',
        'When listing resources, include "_count":"5" in searchParam and summarize the returned entries.',
        "You cannot create, update, patch, or delete. If asked to change data, reply that this assistant is read-only. Do not call any tool for such requests.",
        "Reply in concise Markdown under 100 words. Name the resource type and ids used. Say when the server returned no data.",
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

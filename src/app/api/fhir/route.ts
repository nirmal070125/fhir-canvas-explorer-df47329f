import { resolveFhirTarget } from "@/lib/server/fhir-target";

export const runtime = "nodejs";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
const REQUEST_HEADERS_TO_REMOVE = [
  "accept-encoding",
  "connection",
  "content-length",
  "cookie",
  "forwarded",
  "host",
  "origin",
  "referer",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
];
const RESPONSE_HEADERS_TO_REMOVE = [
  "connection",
  "content-encoding",
  "content-length",
  "set-cookie",
  "set-cookie2",
  "transfer-encoding",
];

function forwardedRequestHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  for (const header of REQUEST_HEADERS_TO_REMOVE) headers.delete(header);

  for (const header of headers.keys()) {
    if (header.startsWith("sec-")) headers.delete(header);
  }

  return headers;
}

function forwardedResponseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  for (const header of RESPONSE_HEADERS_TO_REMOVE) headers.delete(header);
  return headers;
}

async function proxyFhirRequest(request: Request): Promise<Response> {
  const requestedUrl = new URL(request.url).searchParams.get("url");

  let targetUrl: string;
  try {
    targetUrl = await resolveFhirTarget(requestedUrl);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid FHIR URL." },
      { status: 400 },
    );
  }

  try {
    const body = BODYLESS_METHODS.has(request.method) ? undefined : await request.arrayBuffer();
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardedRequestHeaders(request),
      body,
      redirect: "follow",
      signal: request.signal,
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: forwardedResponseHeaders(response),
    });
  } catch (error) {
    console.error("FHIR proxy request failed:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Could not connect to the selected FHIR server." },
      { status: 502 },
    );
  }
}

export const GET = proxyFhirRequest;
export const POST = proxyFhirRequest;
export const PUT = proxyFhirRequest;
export const PATCH = proxyFhirRequest;
export const DELETE = proxyFhirRequest;
export const HEAD = proxyFhirRequest;

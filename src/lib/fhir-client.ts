// Relative path — when the UI is co-hosted with the FHIR server under one gateway,
// browsers resolve this against the current origin (no CORS). Override via the
// BaseUrlBar to point at any other FHIR R4 endpoint (stored in localStorage).
export const DEFAULT_BASE_URL = "/fhir/r4";

const STORAGE_KEY = "fhir-explorer:baseUrl";

export function getBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_BASE_URL;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL;
}

export function setBaseUrl(url: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
}

export interface FhirResponse {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  raw: string;
  url: string;
  method: string;
  durationMs: number;
}

export async function fhirFetch(
  path: string,
  init: RequestInit = {},
  baseOverride?: string,
): Promise<FhirResponse> {
  const base = (baseOverride ?? getBaseUrl()).replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/fhir+json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/fhir+json");
  }

  const start = performance.now();
  const res = await fetch(url, { ...init, method, headers });
  const raw = await res.text();
  const durationMs = Math.round(performance.now() - start);

  let body: unknown = raw;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    /* not json */
  }

  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => (respHeaders[k] = v));

  return {
    status: res.status,
    ok: res.ok,
    headers: respHeaders,
    body,
    raw,
    url,
    method,
    durationMs,
  };
}

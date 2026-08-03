// Relative path — when the UI is co-hosted with the FHIR server under one gateway,
// browsers resolve this against the current origin (no CORS). Override via the
// BaseUrlBar to point at any other FHIR R4 endpoint (stored in localStorage).
import { recordRequest } from "./request-history";

export const DEFAULT_BASE_URL = "/fhir/r4";

const STORAGE_KEY = "fhir-explorer:baseUrl";

const HTTP_SCHEME = /^https?:\/\//i;
// Anything that looks like "<scheme>:" at the very start (e.g. javascript:, data:, file:).
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A base URL is acceptable only if it is a same-origin relative path
 * (starts with a single "/") or an absolute http(s) URL. This blocks
 * javascript:, data:, file:, and protocol-relative ("//host") values from
 * ever being stored or used to build requests.
 */
export function isValidBaseUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return false; // protocol-relative
  if (trimmed.startsWith("/")) return true; // same-origin relative path
  if (!HTTP_SCHEME.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function getBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_BASE_URL;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && isValidBaseUrl(stored) ? stored : DEFAULT_BASE_URL;
}

/** Persists a base URL after validating it. Returns false (and stores nothing) if invalid. */
export function setBaseUrl(url: string): boolean {
  if (typeof window === "undefined") return false;
  const cleaned = url.trim().replace(/\/$/, "");
  if (!isValidBaseUrl(cleaned)) return false;
  localStorage.setItem(STORAGE_KEY, cleaned);
  return true;
}

/**
 * Encode a single FHIR path segment (resource type, id, version) so user input
 * cannot break out of its URL path segment (e.g. inject "../", an extra "?query"
 * or "#fragment"). Normal FHIR ids/types are unaffected.
 */
export function encodeFhirPathSegment(segment: string): string {
  return encodeURIComponent(segment);
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
  const isAbsolute = HTTP_SCHEME.test(path);
  // Absolute URLs reach here from server-supplied Bundle paging/"link" URLs.
  // Only allow http(s) so a malicious server can't get us to dereference
  // javascript:, data:, or file: URLs.
  if (isAbsolute) {
    const u = new URL(path);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error(`Refusing to request non-HTTP(S) URL: ${path}`);
    }
  } else if (ANY_SCHEME.test(path)) {
    throw new Error(`Refusing to request non-HTTP(S) URL: ${path}`);
  }
  const url = isAbsolute ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/fhir+json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/fhir+json");
  }

  const start = performance.now();
  let res: Response;
  try {
    res = await fetch(url, { ...init, method, headers });
  } catch (e) {
    recordRequest({ method, path: isAbsolute ? path : path.startsWith("/") ? path : `/${path}`, status: 0 });
    throw e;
  }
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

  recordRequest({
    method,
    path: isAbsolute ? path : path.startsWith("/") ? path : `/${path}`,
    status: res.status,
  });

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

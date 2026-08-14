import { createHmac, randomBytes } from "node:crypto";
import { isAllowedOrigin } from "@/lib/server/fhir-target";

/**
 * Per-user FHIR tenancy. The nginx-stamped X-Client-Fingerprint is HMAC'd
 * (raw IP + User-Agent would leak into URLs and break the tenant-id charset)
 * and allowlisted-origin requests are rewritten to the wso2/fhir-server's
 * /t/{tenant} prefix, which isolates tenants via Postgres row-level security.
 * External user-supplied FHIR servers keep their URL untouched.
 */

const TENANT_ID_LENGTH = 24;
const FINGERPRINT_HEADER = "x-client-fingerprint";

// HMAC secret so ids can't be computed offline; set TENANT_ID_SECRET for stability
// across restarts, else a random per-process key.
const TENANT_ID_SECRET = process.env.TENANT_ID_SECRET?.trim() || randomBytes(32).toString("hex");

export function tenantIdFromRequest(request: Request): string | null {
  const fingerprint = request.headers.get(FINGERPRINT_HEADER)?.trim();
  if (!fingerprint) return null;
  return createHmac("sha256", TENANT_ID_SECRET)
    .update(fingerprint)
    .digest("hex")
    .slice(0, TENANT_ID_LENGTH);
}

export function applyTenantToFhirUrl(targetUrl: string, tenantId: string | null): string {
  if (!tenantId) return targetUrl;

  const url = new URL(targetUrl);
  if (!isAllowedOrigin(url.origin)) return targetUrl;

  // Only the caller's own prefix passes through (redirect/pagination links come
  // back scoped); any other /t/... on an allowlisted origin is a cross-tenant attempt.
  const ownPrefix = `/t/${tenantId}`;
  if (url.pathname === ownPrefix || url.pathname.startsWith(`${ownPrefix}/`)) return targetUrl;
  if (url.pathname.startsWith("/t/")) {
    throw new Error("Cross-tenant FHIR path is not allowed.");
  }

  url.pathname = `/t/${tenantId}${url.pathname}`;
  return url.toString();
}

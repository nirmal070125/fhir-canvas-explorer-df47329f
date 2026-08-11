import { createHash } from "node:crypto";
import { isAllowedOrigin } from "@/lib/server/fhir-target";

/**
 * Per-user FHIR tenancy. The nginx-stamped X-Client-Fingerprint is hashed
 * (raw IP + User-Agent would leak into URLs and break the tenant-id charset)
 * and allowlisted-origin requests are rewritten to the wso2/fhir-server's
 * /t/{tenant} prefix, which isolates tenants via Postgres row-level security.
 * External user-supplied FHIR servers keep their URL untouched.
 */

const TENANT_ID_LENGTH = 24;
const FINGERPRINT_HEADER = "x-client-fingerprint";

export function tenantIdFromRequest(request: Request): string | null {
  const fingerprint = request.headers.get(FINGERPRINT_HEADER)?.trim();
  if (!fingerprint) return null;
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, TENANT_ID_LENGTH);
}

export function applyTenantToFhirUrl(targetUrl: string, tenantId: string | null): string {
  if (!tenantId) return targetUrl;

  const url = new URL(targetUrl);
  if (!isAllowedOrigin(url.origin)) return targetUrl;
  if (url.pathname.startsWith("/t/")) return targetUrl;

  url.pathname = `/t/${tenantId}${url.pathname}`;
  return url.toString();
}

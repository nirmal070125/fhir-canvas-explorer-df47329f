import { createHash } from "node:crypto";
import { isAllowedOrigin } from "@/lib/server/fhir-target";

/**
 * Per-user FHIR tenancy (issue #28).
 *
 * nginx stamps every request with X-Client-Fingerprint. The wso2/fhir-server
 * isolates tenants by URL prefix (/t/{tenant}/fhir/r4, enforced with Postgres
 * row-level security), so mapping a user to a tenant is just a path rewrite —
 * no provisioning call exists or is needed.
 *
 * The fingerprint is hashed because the raw value (IP + User-Agent) contains
 * characters outside the server's tenant-id charset and would leak the IP into
 * URLs and logs. Truncated SHA-256 keeps the id opaque and well-formed.
 *
 * Only operator-allowlisted origins are rewritten: those are our deployed
 * servers. User-supplied external FHIR servers keep their URL untouched.
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

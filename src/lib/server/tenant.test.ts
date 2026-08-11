import { describe, expect, it } from "vitest";
import { applyTenantToFhirUrl, tenantIdFromRequest } from "@/lib/server/tenant";

function requestWithFingerprint(fingerprint?: string): Request {
  return new Request("http://localhost/api/fhir", {
    headers: fingerprint ? { "X-Client-Fingerprint": fingerprint } : {},
  });
}

describe("tenantIdFromRequest", () => {
  it("returns null when the fingerprint header is absent", () => {
    expect(tenantIdFromRequest(requestWithFingerprint())).toBeNull();
  });

  it("returns null when the fingerprint header is blank", () => {
    expect(tenantIdFromRequest(requestWithFingerprint("   "))).toBeNull();
  });

  it("derives a stable base36 tenant id from the fingerprint", () => {
    const a = tenantIdFromRequest(requestWithFingerprint("203.0.113.7Mozilla/5.0"));
    const b = tenantIdFromRequest(requestWithFingerprint("203.0.113.7Mozilla/5.0"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-z]{16}$/);
  });

  it("derives different tenants for different fingerprints", () => {
    const a = tenantIdFromRequest(requestWithFingerprint("203.0.113.7Mozilla/5.0"));
    const b = tenantIdFromRequest(requestWithFingerprint("203.0.113.8Mozilla/5.0"));
    expect(a).not.toBe(b);
  });
});

describe("applyTenantToFhirUrl", () => {
  const tenant = "abc123";

  it("prefixes /t/{tenant} for allowlisted origins", () => {
    expect(applyTenantToFhirUrl("http://localhost:9090/fhir/r4/Patient?name=smith", tenant)).toBe(
      "http://localhost:9090/t/abc123/fhir/r4/Patient?name=smith",
    );
  });

  it("leaves external origins untouched", () => {
    expect(applyTenantToFhirUrl("https://hapi.fhir.org/baseR4/Patient", tenant)).toBe(
      "https://hapi.fhir.org/baseR4/Patient",
    );
  });

  it("does not double-prefix an already tenant-scoped path", () => {
    expect(applyTenantToFhirUrl("http://localhost:9090/t/abc123/fhir/r4", tenant)).toBe(
      "http://localhost:9090/t/abc123/fhir/r4",
    );
  });

  it("passes the URL through when there is no tenant", () => {
    expect(applyTenantToFhirUrl("http://localhost:9090/fhir/r4", null)).toBe(
      "http://localhost:9090/fhir/r4",
    );
  });
});

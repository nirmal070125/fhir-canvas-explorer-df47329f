import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { z } from "zod";

/**
 * Server-side validation for user-supplied FHIR target URLs (SSRF guard).
 *
 * Two layers:
 * 1. An operator-configured origin allowlist (FHIR_ALLOWED_ORIGINS, comma-separated).
 *    Allowlisted origins may point anywhere — including localhost, which is the
 *    default dev setup with the docker FHIR server on :9090.
 * 2. Any other origin must resolve exclusively to public addresses: the hostname
 *    is DNS-resolved and rejected if any address is loopback, private, link-local,
 *    or otherwise non-routable.
 */

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:9090", "http://127.0.0.1:9090"];

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().includes(origin);
}

function allowedOrigins(): string[] {
  const configured = process.env.FHIR_ALLOWED_ORIGINS?.trim();
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function isPublicAddress(ip: string): boolean {
  let parsed = ipaddr.parse(ip);
  if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address();
  }
  return parsed.range() === "unicast";
}

const fhirBaseUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "The FHIR base URL must use HTTP or HTTPS.");

export async function resolveFhirTarget(input: unknown): Promise<string> {
  const result = fhirBaseUrlSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "A valid FHIR base URL is required.");
  }

  const url = new URL(result.data);
  if (allowedOrigins().includes(url.origin)) return result.data;

  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const resolved = await lookup(hostname, { all: true });
      addresses = resolved.map(({ address }) => address);
    } catch {
      throw new Error("The FHIR base URL hostname could not be resolved.");
    }
  }

  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new Error("The FHIR base URL must not target a private or internal address.");
  }

  return result.data;
}

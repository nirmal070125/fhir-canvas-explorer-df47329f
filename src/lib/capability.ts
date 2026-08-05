/**
 * Typed view over a FHIR CapabilityStatement (`GET /metadata`).
 *
 * The raw resource is deeply nested and served by arbitrary third-party
 * servers, so everything here treats the body as untrusted `unknown` and
 * narrows defensively instead of casting.
 */

export interface CapabilityResource {
  type: string;
  interactions: string[];
  searchParamCount: number;
}

export interface CapabilitySummary {
  fhirVersion?: string;
  softwareName?: string;
  softwareVersion?: string;
  resources: CapabilityResource[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function parseResource(value: unknown): CapabilityResource | null {
  if (!isRecord(value)) return null;
  const type = asString(value.type);
  if (!type) return null;
  const interactions = Array.isArray(value.interaction)
    ? value.interaction
        .map((i) => (isRecord(i) ? asString(i.code) : undefined))
        .filter((code): code is string => code !== undefined)
    : [];
  const searchParamCount = Array.isArray(value.searchParam) ? value.searchParam.length : 0;
  return { type, interactions, searchParamCount };
}

/** Parses an untrusted response body into a flat, render-ready summary. */
export function parseCapabilityStatement(body: unknown): CapabilitySummary {
  if (!isRecord(body)) return { resources: [] };
  const software = isRecord(body.software) ? body.software : {};
  const resources = (Array.isArray(body.rest) ? body.rest : [])
    .flatMap((rest) => (isRecord(rest) && Array.isArray(rest.resource) ? rest.resource : []))
    .map(parseResource)
    .filter((r): r is CapabilityResource => r !== null);
  return {
    fhirVersion: asString(body.fhirVersion),
    softwareName: asString(software.name),
    softwareVersion: asString(software.version),
    resources,
  };
}

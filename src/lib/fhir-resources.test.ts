import { describe, it, expect } from "vitest";
import {
  FHIR_R4_RESOURCE_TYPES,
  isKnownResourceType,
  partitionResourceTypes,
} from "./fhir-resources";

describe("FHIR R4 resource catalogue", () => {
  it("contains the well-known resource types", () => {
    for (const t of ["Patient", "Observation", "Encounter", "Bundle", "CapabilityStatement"]) {
      expect(FHIR_R4_RESOURCE_TYPES).toContain(t);
    }
  });

  it("has no duplicates and is reasonably complete", () => {
    expect(new Set(FHIR_R4_RESOURCE_TYPES).size).toBe(FHIR_R4_RESOURCE_TYPES.length);
    expect(FHIR_R4_RESOURCE_TYPES.length).toBeGreaterThan(140);
  });

  it("recognises known vs unknown types", () => {
    expect(isKnownResourceType("Patient")).toBe(true);
    expect(isKnownResourceType("NotAResource")).toBe(false);
  });
});

describe("partitionResourceTypes", () => {
  it("keeps supported types first and excludes them from the rest", () => {
    const { supported, others } = partitionResourceTypes(["Patient", "Observation"]);
    expect(supported).toEqual(["Patient", "Observation"]);
    expect(others).not.toContain("Patient");
    expect(others).not.toContain("Observation");
    expect(others).toContain("Encounter");
  });

  it("returns the full catalogue as others when nothing is supported", () => {
    const { supported, others } = partitionResourceTypes([]);
    expect(supported).toEqual([]);
    expect(others).toEqual([...FHIR_R4_RESOURCE_TYPES]);
  });

  it("retains custom (non-R4) supported types in the supported bucket", () => {
    const { supported } = partitionResourceTypes(["CustomResource"]);
    expect(supported).toContain("CustomResource");
  });
});

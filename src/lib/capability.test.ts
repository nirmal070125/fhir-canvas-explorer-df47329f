import { describe, expect, it } from "vitest";
import { parseCapabilityStatement } from "./capability";

describe("parseCapabilityStatement", () => {
  it("extracts version, software, and resource rows", () => {
    const summary = parseCapabilityStatement({
      resourceType: "CapabilityStatement",
      fhirVersion: "4.0.1",
      software: { name: "fhir-server", version: "1.2.3" },
      rest: [
        {
          mode: "server",
          resource: [
            {
              type: "Patient",
              interaction: [{ code: "read" }, { code: "search-type" }],
              searchParam: [{ name: "name" }, { name: "birthdate" }],
            },
            { type: "Observation" },
          ],
        },
      ],
    });

    expect(summary.fhirVersion).toBe("4.0.1");
    expect(summary.softwareName).toBe("fhir-server");
    expect(summary.softwareVersion).toBe("1.2.3");
    expect(summary.resources).toEqual([
      { type: "Patient", interactions: ["read", "search-type"], searchParamCount: 2 },
      { type: "Observation", interactions: [], searchParamCount: 0 },
    ]);
  });

  it("flattens resources across multiple rest entries", () => {
    const summary = parseCapabilityStatement({
      rest: [
        { mode: "server", resource: [{ type: "Patient" }] },
        { mode: "client", resource: [{ type: "Encounter" }] },
      ],
    });
    expect(summary.resources.map((r) => r.type)).toEqual(["Patient", "Encounter"]);
  });

  it("returns an empty summary for null, non-object, or malformed bodies", () => {
    for (const body of [null, undefined, "nope", 42, [], {}, { rest: "bad" }, { rest: [{}] }]) {
      const summary = parseCapabilityStatement(body);
      expect(summary.resources).toEqual([]);
      expect(summary.fhirVersion).toBeUndefined();
    }
  });

  it("skips resource entries without a type and tolerates malformed members", () => {
    const summary = parseCapabilityStatement({
      rest: [
        {
          resource: [
            { interaction: [{ code: "read" }] },
            { type: "Patient", interaction: "bad", searchParam: "bad" },
            "junk",
          ],
        },
      ],
    });
    expect(summary.resources).toEqual([{ type: "Patient", interactions: [], searchParamCount: 0 }]);
  });
});

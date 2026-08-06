import { describe, it, expect } from "vitest";
import { COMMON_SEARCH_PARAMS, mergeSearchParams, valueHintForType } from "./fhir-search-params";

describe("mergeSearchParams", () => {
  it("lists resource-specific params (sorted) before common result/meta params", () => {
    const params = mergeSearchParams("Patient");
    const names = params.map((p) => p.name);
    expect(names).toContain("family");
    expect(names).toContain("_count");
    // resource-specific before common
    expect(names.indexOf("family")).toBeLessThan(names.indexOf("_count"));
    // resource-specific block is alphabetised
    const specific = names.slice(0, names.indexOf("_id"));
    expect([...specific].sort((a, b) => a.localeCompare(b))).toEqual(specific);
  });

  it("always appends the common parameters", () => {
    const names = mergeSearchParams("Patient").map((p) => p.name);
    for (const c of COMMON_SEARCH_PARAMS) expect(names).toContain(c.name);
  });

  it("augments with capability params and lets capability docs win", () => {
    const params = mergeSearchParams("Patient", [
      { name: "family", type: "string", documentation: "FROM SERVER" },
      { name: "link", type: "reference", documentation: "Other patient linked to" },
    ]);
    const byName = new Map(params.map((p) => [p.name, p]));
    expect(byName.get("family")?.documentation).toBe("FROM SERVER");
    expect(byName.get("link")).toBeTruthy();
    expect(byName.get("link")?.type).toBe("reference");
  });

  it("falls back to common-only for unknown resource types", () => {
    const names = mergeSearchParams("ZZUnknown").map((p) => p.name);
    expect(names).toEqual(COMMON_SEARCH_PARAMS.map((p) => p.name));
  });

  it("does not duplicate a param that exists in both curated and capability", () => {
    const params = mergeSearchParams("Patient", [{ name: "gender", type: "token" }]);
    expect(params.filter((p) => p.name === "gender")).toHaveLength(1);
  });
});

describe("valueHintForType", () => {
  it("gives a type-appropriate example", () => {
    expect(valueHintForType("date")).toMatch(/2024/);
    expect(valueHintForType("reference")).toMatch(/Patient\//);
    expect(valueHintForType("token")).toMatch(/system\|code|code/);
  });

  it("falls back to a generic hint for unknown/undefined types", () => {
    expect(valueHintForType(undefined)).toBe("value");
  });
});

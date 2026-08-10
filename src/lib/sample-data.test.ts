import { describe, expect, it } from "vitest";
import { stripPostResourceIds } from "./sample-data";

describe("stripPostResourceIds", () => {
  it("removes resource.id from POST entries only", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        {
          fullUrl: "urn:uuid:1",
          request: { method: "POST", url: "Patient" },
          resource: { resourceType: "Patient", id: "p1" },
        },
        {
          request: { method: "PUT", url: "Organization/org1" },
          resource: { resourceType: "Organization", id: "org1" },
        },
      ],
    };

    stripPostResourceIds(bundle);

    expect(bundle.entry[0].resource.id).toBeUndefined();
    expect(bundle.entry[1].resource.id).toBe("org1");
  });

  it("tolerates malformed bundles", () => {
    expect(stripPostResourceIds(null)).toBeNull();
    expect(stripPostResourceIds({ entry: "nope" })).toEqual({ entry: "nope" });
    expect(stripPostResourceIds({ entry: [{ request: { method: "POST" } }] })).toEqual({
      entry: [{ request: { method: "POST" } }],
    });
  });
});

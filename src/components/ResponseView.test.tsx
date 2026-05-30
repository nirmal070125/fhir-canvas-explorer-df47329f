import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponseView } from "./ResponseView";
import type { FhirResponse } from "@/lib/fhir-client";

function makeResponse(overrides: Partial<FhirResponse> = {}): FhirResponse {
  return {
    status: 200,
    ok: true,
    headers: {},
    body: { resourceType: "Patient", id: "1" },
    raw: '{"resourceType":"Patient","id":"1"}',
    url: "https://example.org/fhir/r4/Patient/1",
    method: "GET",
    durationMs: 42,
    ...overrides,
  };
}

describe("ResponseView", () => {
  it("shows an empty placeholder when there is no response", () => {
    render(<ResponseView res={null} />);
    expect(screen.getByText(/response will appear here/i)).toBeInTheDocument();
  });

  it("renders the status line with method, status, duration and url", () => {
    render(<ResponseView res={makeResponse()} />);
    expect(screen.getByText("GET 200")).toBeInTheDocument();
    expect(screen.getByText("42ms")).toBeInTheDocument();
    expect(screen.getByText("https://example.org/fhir/r4/Patient/1")).toBeInTheDocument();
  });

  it("pretty-prints the JSON body", () => {
    render(<ResponseView res={makeResponse()} />);
    // Pretty-printed JSON spreads the object across lines / indentation.
    expect(screen.getByText(/"resourceType": "Patient"/)).toBeInTheDocument();
  });

  it("renders a collapsible headers section when headers are present", () => {
    render(<ResponseView res={makeResponse({ headers: { "content-type": "application/fhir+json" } })} />);
    expect(screen.getByText(/headers \(1\)/i)).toBeInTheDocument();
  });
});

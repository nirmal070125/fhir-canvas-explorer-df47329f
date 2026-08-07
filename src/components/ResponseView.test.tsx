import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders the JSON body as a highlighted tree", () => {
    render(<ResponseView res={makeResponse()} />);
    // JsonView splits keys and values into separate colored spans.
    expect(screen.getByText("resourceType")).toBeInTheDocument();
    expect(screen.getByText('"Patient"')).toBeInTheDocument();
  });

  it("renders a collapsible headers section when headers are present", () => {
    render(
      <ResponseView res={makeResponse({ headers: { "content-type": "application/fhir+json" } })} />,
    );
    // Header count renders as a badge next to the "Headers" summary label.
    expect(screen.getByText(/^headers$/i)).toBeInTheDocument();
    expect(screen.getByText("content-type")).toBeInTheDocument();
    expect(screen.getByText("application/fhir+json")).toBeInTheDocument();
  });

  it("copies the response JSON to the clipboard", async () => {
    const user = userEvent.setup();
    // Override after setup() so our spy (not user-event's stub) receives the call.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ResponseView res={makeResponse()} />);
    await user.click(screen.getByRole("button", { name: /copy response/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"resourceType": "Patient"'));
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it("offers a download button", () => {
    render(<ResponseView res={makeResponse()} />);
    expect(screen.getByRole("button", { name: /download response/i })).toBeInTheDocument();
  });

  it("renders OperationOutcome issues human-readably", () => {
    const oo = {
      resourceType: "OperationOutcome",
      issue: [
        { severity: "error", code: "invalid", diagnostics: "Patient.gender has invalid value" },
        { severity: "warning", code: "informational", diagnostics: "Deprecated element used" },
      ],
    };
    render(<ResponseView res={makeResponse({ status: 400, ok: false, body: oo })} />);
    expect(screen.getByText(/OperationOutcome · 2 issues/i)).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("Patient.gender has invalid value")).toBeInTheDocument();
    expect(screen.getByText("warning")).toBeInTheDocument();
  });
});

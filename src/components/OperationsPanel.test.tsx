import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { OperationsPanel } from "./OperationsPanel";
import * as client from "@/lib/fhir-client";

vi.mock("@/lib/fhir-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fhir-client")>();
  return { ...actual, fhirFetch: vi.fn() };
});

const BASE = "https://example.org/fhir/r4";

function okResponse() {
  return {
    status: 200,
    ok: true,
    headers: {},
    body: { resourceType: "Bundle" },
    raw: "{}",
    url: BASE,
    method: "GET",
    durationMs: 1,
  };
}

beforeEach(() => {
  vi.mocked(client.fhirFetch).mockResolvedValue(okResponse());
});

describe("OperationsPanel", () => {
  it("defaults to instance / Patient / $everything and disables Invoke until an id is given", () => {
    renderWithProviders(<OperationsPanel baseUrl={BASE} />);
    expect(screen.getByRole("combobox", { name: /operation/i })).toHaveTextContent("$everything");
    expect(screen.getByRole("button", { name: /invoke/i })).toBeDisabled();
  });

  it("invokes an instance operation as GET with the built path", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OperationsPanel baseUrl={BASE} />);
    await user.type(screen.getByPlaceholderText("resource id"), "123");
    await user.click(screen.getByRole("button", { name: /invoke/i }));
    expect(client.fhirFetch).toHaveBeenCalledWith("/Patient/123/$everything", {}, BASE);
  });

  it("appends filled primitive parameters to the GET query string", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OperationsPanel baseUrl={BASE} />);
    await user.type(screen.getByPlaceholderText("resource id"), "123");
    await user.type(screen.getByRole("textbox", { name: /value for _count/i }), "10");
    await user.click(screen.getByRole("button", { name: /invoke/i }));
    expect(client.fhirFetch).toHaveBeenCalledWith("/Patient/123/$everything?_count=10", {}, BASE);
  });

  it("switches to POST and sends a Parameters body when a resource input is provided", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OperationsPanel baseUrl={BASE} />);

    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.click(screen.getByRole("combobox", { name: /operation/i }));
    await user.type(screen.getByPlaceholderText(/search operations/i), "validate");
    await user.click(screen.getByRole("option", { name: /resource is valid/i }));

    // Brace-laden JSON is awkward to type via userEvent, so set it directly.
    const resourceInput = screen.getByRole("textbox", { name: /value for resource/i });
    fireEvent.change(resourceInput, { target: { value: '{"resourceType":"Patient","id":"x"}' } });

    await user.click(screen.getByRole("button", { name: /invoke/i }));

    expect(client.fhirFetch).toHaveBeenCalledWith(
      "/Patient/$validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/fhir+json" },
        body: JSON.stringify(
          {
            resourceType: "Parameters",
            parameter: [{ name: "resource", resource: { resourceType: "Patient", id: "x" } }],
          },
          null,
          2,
        ),
      },
      BASE,
    );
  });

  it("hides the resource-type and id inputs at system scope", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OperationsPanel baseUrl={BASE} />);
    await user.click(screen.getByRole("button", { name: "System" }));
    expect(screen.queryByPlaceholderText("resource id")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /resource type/i })).not.toBeInTheDocument();
  });
});

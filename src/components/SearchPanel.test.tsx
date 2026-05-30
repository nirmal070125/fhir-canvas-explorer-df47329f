import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { SearchPanel } from "./SearchPanel";
import * as client from "@/lib/fhir-client";

vi.mock("@/lib/fhir-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fhir-client")>();
  return { ...actual, fhirFetch: vi.fn() };
});

const BASE = "https://example.org/fhir/r4";

function okBundle() {
  return {
    status: 200,
    ok: true,
    headers: {},
    body: { resourceType: "Bundle", entry: [], total: 0 },
    raw: "{}",
    url: `${BASE}/Patient`,
    method: "GET",
    durationMs: 1,
  };
}

beforeEach(() => {
  vi.mocked(client.fhirFetch).mockResolvedValue(okBundle());
});

describe("SearchPanel", () => {
  it("starts on Patient with a default _count=10 parameter", () => {
    renderWithProviders(<SearchPanel baseUrl={BASE} />);
    expect(screen.getByRole("combobox", { name: /resource type/i })).toHaveTextContent("Patient");
    expect(screen.getByDisplayValue("_count")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("issues a GET search with the built query string", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchPanel baseUrl={BASE} />);
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    expect(client.fhirFetch).toHaveBeenCalledWith("/Patient?_count=10", {}, BASE);
  });

  it("adds and removes parameter rows", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchPanel baseUrl={BASE} />);
    const keyInputs = () => screen.getAllByPlaceholderText(/name \(e\.g\./i);
    expect(keyInputs()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /add parameter/i }));
    expect(keyInputs()).toHaveLength(2);

    // Before a search runs, the only text-less (icon-only) buttons are the
    // per-row remove buttons.
    const trashButtons = screen.getAllByRole("button").filter((b) => b.textContent === "");
    await user.click(trashButtons[0]);
    expect(keyInputs()).toHaveLength(1);
  });

  it("reflects a resource type chosen from the combobox in the request path", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchPanel baseUrl={BASE} />);
    await user.click(screen.getByRole("combobox", { name: /resource type/i }));
    await user.type(screen.getByPlaceholderText(/search resource type/i), "Observation");
    await user.click(screen.getByRole("option", { name: "Observation" }));
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    expect(client.fhirFetch).toHaveBeenCalledWith("/Observation?_count=10", {}, BASE);
  });
});

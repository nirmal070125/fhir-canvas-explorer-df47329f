import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    render(<SearchPanel baseUrl={BASE} />);
    expect(screen.getByLabelText(/resource type/i)).toHaveValue("Patient");
    expect(screen.getByDisplayValue("_count")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("issues a GET search with the built query string", async () => {
    const user = userEvent.setup();
    render(<SearchPanel baseUrl={BASE} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(client.fhirFetch).toHaveBeenCalledWith("/Patient?_count=10", {}, BASE);
  });

  it("adds and removes parameter rows", async () => {
    const user = userEvent.setup();
    render(<SearchPanel baseUrl={BASE} />);
    const keyInputs = () => screen.getAllByPlaceholderText(/name \(e\.g\./i);
    expect(keyInputs()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /add parameter/i }));
    expect(keyInputs()).toHaveLength(2);

    // Remove the first row via its trash button. Before a search runs, the only
    // text-less (icon-only) buttons on screen are the per-row remove buttons.
    const trashButtons = screen.getAllByRole("button").filter((b) => b.textContent === "");
    await user.click(trashButtons[0]);
    expect(keyInputs()).toHaveLength(1);
  });

  it("reflects a changed resource type in the request path", async () => {
    const user = userEvent.setup();
    render(<SearchPanel baseUrl={BASE} />);
    const rt = screen.getByLabelText(/resource type/i);
    await user.clear(rt);
    await user.type(rt, "Observation");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(client.fhirFetch).toHaveBeenCalledWith("/Observation?_count=10", {}, BASE);
  });
});

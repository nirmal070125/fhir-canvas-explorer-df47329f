import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadSampleDataButton } from "./LoadSampleDataButton";
import * as sampleData from "@/lib/sample-data";

vi.mock("@/lib/sample-data", () => ({
  loadManifest: vi.fn(),
  loadSampleData: vi.fn(),
}));

function manifest(patientCount: number) {
  return {
    generatedAt: "2026-05-31",
    generator: "Synthea",
    fhirVersion: "4.0.1",
    patientCount,
    bundles: [],
  };
}

describe("LoadSampleDataButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("labels the seed count from the manifest (not a hard-coded number)", async () => {
    vi.mocked(sampleData.loadManifest).mockResolvedValue(manifest(6));
    render(<LoadSampleDataButton baseUrl="http://x" />);
    // The description now lives in the button's tooltip (title attribute).
    const button = screen.getByRole("button", { name: /load sample data/i });
    await vi.waitFor(() =>
      expect(button).toHaveAttribute("title", expect.stringMatching(/6 synthetic patients/i)),
    );
    expect(button.getAttribute("title")).not.toMatch(/10 synthetic patients/i);
  });

  it("falls back to a generic label when the manifest can't be read", async () => {
    vi.mocked(sampleData.loadManifest).mockRejectedValue(new Error("nope"));
    render(<LoadSampleDataButton baseUrl="http://x" />);
    const button = screen.getByRole("button", { name: /load sample data/i });
    await vi.waitFor(() =>
      expect(button).toHaveAttribute(
        "title",
        expect.stringMatching(/seeds synthetic patient data/i),
      ),
    );
  });

  it("renders the load button", () => {
    vi.mocked(sampleData.loadManifest).mockResolvedValue(manifest(6));
    render(<LoadSampleDataButton baseUrl="http://x" />);
    expect(screen.getByRole("button", { name: /load sample data/i })).toBeInTheDocument();
  });

  it("persistently disables the button after a successful load", async () => {
    const user = userEvent.setup();
    vi.mocked(sampleData.loadManifest).mockResolvedValue(manifest(6));
    vi.mocked(sampleData.loadSampleData).mockResolvedValue({
      ok: 8,
      failed: 0,
      resources: 71,
      durationMs: 319,
      errors: [],
    });

    const { unmount } = render(<LoadSampleDataButton baseUrl="http://x" />);
    await user.click(screen.getByRole("button", { name: /load sample data/i }));

    expect(await screen.findByRole("button", { name: /sample data loaded/i })).toBeDisabled();
    unmount();

    render(<LoadSampleDataButton baseUrl="http://x" />);
    expect(screen.getByRole("button", { name: /sample data loaded/i })).toBeDisabled();
  });

  it("allows retrying when any bundle fails", async () => {
    const user = userEvent.setup();
    vi.mocked(sampleData.loadManifest).mockResolvedValue(manifest(6));
    vi.mocked(sampleData.loadSampleData).mockResolvedValue({
      ok: 7,
      failed: 1,
      resources: 60,
      durationMs: 319,
      errors: [{ file: "bundle.json", message: "Server returned HTTP 500" }],
    });

    render(<LoadSampleDataButton baseUrl="http://x" />);
    await user.click(screen.getByRole("button", { name: /load sample data/i }));

    expect(await screen.findByRole("button", { name: /load sample data/i })).toBeEnabled();
  });
});

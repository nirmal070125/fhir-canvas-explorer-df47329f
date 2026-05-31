import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  it("writes its value to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<CopyButton value="Patient/123" />);
    await user.click(screen.getByRole("button", { name: /copy patient\/123/i }));

    expect(writeText).toHaveBeenCalledWith("Patient/123");
    expect(await screen.findByRole("button", { name: /copy patient\/123/i })).toBeInTheDocument();
  });

  it("uses a custom aria-label when provided", () => {
    render(<CopyButton value="x" ariaLabel="Copy reference Foo/1" />);
    expect(screen.getByRole("button", { name: "Copy reference Foo/1" })).toBeInTheDocument();
  });
});

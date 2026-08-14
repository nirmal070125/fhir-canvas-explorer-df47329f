import { describe, expect, it } from "vitest";
import {
  ChatRateLimitError,
  encodeBlockedError,
  encodeBudgetError,
  parseChatLimit,
  resetAtFromHeader,
} from "@/lib/chat-rate-limit";

describe("parseChatLimit", () => {
  it("returns null for no error or a generic error", () => {
    expect(parseChatLimit(undefined)).toBeNull();
    expect(parseChatLimit(new Error("boom"))).toBeNull();
  });

  it("maps a ChatRateLimitError to a per-minute limit with its Retry-After", () => {
    expect(parseChatLimit(new ChatRateLimitError(42))).toEqual({
      kind: "per-minute",
      retryAfterSec: 42,
    });
  });

  it("round-trips an encoded budget error into a weekly-budget limit", () => {
    const resetAt = "2026-01-08T00:00:00.000Z";
    expect(parseChatLimit(new Error(encodeBudgetError(resetAt)))).toEqual({
      kind: "weekly-budget",
      resetAt,
    });
    expect(parseChatLimit(new Error(encodeBudgetError(null)))).toEqual({
      kind: "weekly-budget",
      resetAt: null,
    });
  });

  it("maps an encoded blocked error to a blocked limit", () => {
    expect(parseChatLimit(new Error(encodeBlockedError()))).toEqual({ kind: "blocked" });
  });
});

describe("resetAtFromHeader", () => {
  it("returns null for missing or non-positive values", () => {
    expect(resetAtFromHeader(undefined)).toBeNull();
    expect(resetAtFromHeader("nope")).toBeNull();
    expect(resetAtFromHeader("0")).toBeNull();
  });

  it("treats a large value as an absolute epoch (seconds)", () => {
    const epochSec = 1_767_830_400; // 2026-01-08T00:00:00Z
    expect(resetAtFromHeader(String(epochSec))).toBe(new Date(epochSec * 1000).toISOString());
  });

  it("treats a small value as a delta from now", () => {
    const iso = resetAtFromHeader("60");
    expect(iso).not.toBeNull();
    expect(new Date(iso as string).getTime()).toBeGreaterThan(Date.now());
  });
});

/**
 * Minimal in-memory sliding-window rate limiter for single-instance deployments.
 * Not distributed — a multi-replica deployment needs a shared store instead.
 */

const requestLog = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (requestLog.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    requestLog.set(key, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(key, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded with one-off keys.
  if (requestLog.size > 10_000) {
    for (const [k, times] of requestLog) {
      if (times.every((t) => t <= cutoff)) requestLog.delete(k);
    }
  }

  return false;
}

/** Client key for rate limiting: first hop of x-forwarded-for, else a shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

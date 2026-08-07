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

/**
 * Client key for rate limiting: the reverse proxy's X-Real-IP, which (unlike the first
 * X-Forwarded-For hop) the client cannot forge — nginx overwrites it from $remote_addr.
 * Without the nginx front end everyone shares the "unknown" bucket, which fails closed.
 */
export function clientKey(request: Request): string {
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

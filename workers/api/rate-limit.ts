/**
 * Workers rate limiting bindings (docs/supabase-exit/STEP1_DESIGN.md 9.1).
 * Counts are per Cloudflare location and approximate. A missing binding or a
 * failing check never blocks: the limiter guards Supabase, it is not a gate.
 */

export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type RateLimitEnv = {
  /** 600 per 60 s per client IP: uncached public reads. */
  API_READ_LIMITER?: RateLimiter;
  /** 30 per 60 s per verified user: writes and personal reads. */
  API_WRITE_LIMITER?: RateLimiter;
};

export type RateLimitKind = "ip" | "user";

const CHECK_TIMEOUT_MS = 500;

/** True when the request may go on. */
export async function withinRateLimit(
  env: RateLimitEnv,
  kind: RateLimitKind,
  subject: string | null,
): Promise<boolean> {
  const limiter = kind === "ip" ? env.API_READ_LIMITER : env.API_WRITE_LIMITER;
  if (!limiter || !subject) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      limiter.limit({ key: `${kind}:${subject}` }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CHECK_TIMEOUT_MS);
      }),
    ]);
    return outcome === null ? true : outcome.success !== false;
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/** The client IP Cloudflare saw; null outside Cloudflare (specs, some local runs). */
export function clientIp(request: Request): string | null {
  const ip = request.headers.get("cf-connecting-ip");
  return ip && ip.length <= 64 ? ip : null;
}

import type { ClaimSession } from "../../../src/lib/identity-cookies";
import type { Fetcher, SupabaseApiConfig } from "../supabase-rest";
import { SIGNUP_TIMEOUT_MS } from "./supabase-signup";

/**
 * Supabase session refresh on a returning user's behalf (docs/supabase-exit/STEP6_PLAN.md
 * WP-A 5): the same `POST /auth/v1/token?grant_type=refresh_token` supabase-js
 * `refreshSession()` sent from the browser until step 6, with the publishable key
 * the Worker already has, sent the way supabase-signup.ts sends the sign-up. The
 * claim uses it only when the stored access token can no longer be claimed, so the
 * user keeps the uid supabase-js would have kept by refreshing.
 *
 * `refused`: Supabase Auth turned the refresh token down (a 4xx other than 429:
 * unknown, already used, revoked), which supabase-js answered by dropping the
 * session. Anything else (429, 5xx, timeout, network, a body that is not a session)
 * is an Auth outage, which supabase-js answered by keeping the session to retry.
 */

const MAX_RESPONSE_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RefreshResult =
  | { ok: true; uid: string; session: ClaimSession }
  | { ok: false; refused: boolean; code: string };

function sessionFrom(body: unknown, nowSeconds: number): { uid: string; session: ClaimSession } | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const user = value.user as Record<string, unknown> | undefined;
  const uid = typeof user?.id === "string" ? user.id.toLowerCase() : null;
  if (!uid || !UUID.test(uid)) return null;
  if (typeof value.access_token !== "string" || value.access_token.length === 0) return null;
  if (typeof value.refresh_token !== "string" || value.refresh_token.length === 0) return null;
  const expiresIn = typeof value.expires_in === "number" && Number.isFinite(value.expires_in) ? value.expires_in : 3600;
  const expiresAt = typeof value.expires_at === "number" && Number.isFinite(value.expires_at)
    ? value.expires_at
    : nowSeconds + expiresIn;
  return {
    uid,
    session: {
      access_token: value.access_token,
      refresh_token: value.refresh_token,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: typeof value.token_type === "string" ? value.token_type : "bearer",
      user: user as Record<string, unknown>,
    },
  };
}

/** Never throws: any failure is `{ ok: false }` with a loggable code (no body text, no token). */
export async function supabaseRefreshSession(
  config: SupabaseApiConfig,
  refreshToken: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
  timeoutMs = SIGNUP_TIMEOUT_MS,
): Promise<RefreshResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const outage = (code: string): RefreshResult => ({ ok: false, refused: false, code });
  try {
    let response: Response;
    try {
      response = await fetcher(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          apikey: config.key,
          "Content-Type": "application/json;charset=UTF-8",
          // supabase-js pins this API version; it fixes the session response shape.
          "X-Supabase-Api-Version": "2024-01-01",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: controller.signal,
      });
    } catch {
      return outage(controller.signal.aborted ? "timeout" : "network");
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      const refused = response.status >= 400 && response.status < 500 && response.status !== 429;
      return { ok: false, refused, code: `http_${response.status}` };
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      return outage(controller.signal.aborted ? "timeout" : "network");
    }
    if (text.length > MAX_RESPONSE_BYTES) return outage("too_large");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return outage("bad_response");
    }
    const session = sessionFrom(parsed, Math.floor(Date.now() / 1000));
    return session ? { ok: true, ...session } : outage("bad_response");
  } finally {
    clearTimeout(timer);
  }
}

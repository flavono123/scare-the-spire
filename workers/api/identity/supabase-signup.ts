import type { ClaimSession } from "../../../src/lib/identity-cookies";
import type { Fetcher, SupabaseApiConfig } from "../supabase-rest";

/**
 * Supabase anonymous sign-up on a new user's behalf (docs/SUPABASE_EXIT_PLAN.md
 * 5.3): the same `POST /auth/v1/signup` supabase-js `signInAnonymously()` sends,
 * with the publishable key the Worker already has. The uid and the session go
 * back to the browser so supabase-js holds the same identity as the cookie.
 */

export const SIGNUP_TIMEOUT_MS = 4000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SignupResult =
  | { ok: true; uid: string; session: ClaimSession }
  | { ok: false; code: string };

function sessionFrom(body: unknown, nowSeconds: number): { uid: string; session: ClaimSession } | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const user = value.user as Record<string, unknown> | undefined;
  const uid = typeof user?.id === "string" ? user.id.toLowerCase() : null;
  if (!uid || !UUID.test(uid)) return null;
  if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string") return null;
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
    },
  };
}

/** Never throws: any failure is `{ ok: false }` with a loggable code (no body text). */
export async function supabaseAnonymousSignup(
  config: SupabaseApiConfig,
  fetcher: Fetcher = (input, init) => fetch(input, init),
  timeoutMs = SIGNUP_TIMEOUT_MS,
): Promise<SignupResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetcher(`${config.url}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: config.key,
          "Content-Type": "application/json;charset=UTF-8",
          // supabase-js pins this API version; it fixes the session response shape.
          "X-Supabase-Api-Version": "2024-01-01",
        },
        body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
        signal: controller.signal,
      });
    } catch {
      return { ok: false, code: controller.signal.aborted ? "timeout" : "network" };
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      return { ok: false, code: `http_${response.status}` };
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      return { ok: false, code: controller.signal.aborted ? "timeout" : "network" };
    }
    if (text.length > MAX_RESPONSE_BYTES) return { ok: false, code: "too_large" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, code: "bad_response" };
    }
    const session = sessionFrom(parsed, Math.floor(Date.now() / 1000));
    return session ? { ok: true, ...session } : { ok: false, code: "bad_response" };
  } finally {
    clearTimeout(timer);
  }
}

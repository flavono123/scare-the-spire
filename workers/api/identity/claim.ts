import type { ApiSurfaceGroup } from "../../../src/lib/api-surfaces";
import { IDENTITY_COOKIE_NAME, IDENTITY_MODE_COOKIE_NAME, type ClaimResponse, type ClaimSession } from "../../../src/lib/identity-cookies";
import { qaOverride, readCookie } from "../flag-cookie";
import { flagsDisabledReason, type ExecutionContextLike } from "../flags";
import { API_MARKER_HEADER, apiError, jsonResponse, legacyResponse, PRIVATE_NO_STORE, type ApiErrorCode } from "../http";
import { checkSupabaseAccessToken, fetchSupabaseJwks } from "../jwt";
import { clientIp, withinRateLimit, type RateLimitEnv } from "../rate-limit";
import { supabaseApiConfig, supabaseIssuer, type Fetcher, type SupabaseApiConfig } from "../supabase-rest";
import { verificationKeys } from "../verification-keys";
import { identityCookieHeader, identityModeCookieHeader, identitySecret, signIdentityCookie, verifyIdentityCookie } from "./cookie";
import { apiIdentityMode, type IdentityFlagsEnv } from "./mode";
import { supabaseAnonymousSignup } from "./supabase-signup";

/**
 * `POST /api/auth/claim` (docs/SUPABASE_EXIT_PLAN.md 5.3), answered only while
 * `identity.mode` is `cookie`; otherwise 409 surface_legacy like every router
 * path whose flag is off.
 *
 * - `{ "access_token": "<Supabase JWT>" }`: an existing user. The signature
 *   (pinned ES256 JWKS, or the legacy HS256 secret when bound), `iss`, `sub` and
 *   `is_anonymous` are checked; `exp` is not, except for the claim deadline:
 *   a token is claimable until CLAIM_WINDOW_SECONDS after it expired. The
 *   cookie carries the token's uid. Sending it again gives the same cookie uid.
 *   The browser keeps its Supabase session in localStorage (plan: until step 7).
 * - `{}`: a new user. A request that already has a valid cookie keeps it.
 *   Otherwise the Worker signs up anonymously on Supabase and returns that
 *   session so supabase-js holds the same uid. When that sign-up fails the
 *   answer is 503 auth_unavailable and no cookie, as a failed anonymous sign-in
 *   leaves the user unable to write today. The Worker makes no uid of its own
 *   while Supabase holds the data (a uid outside auth.users breaks its FKs);
 *   plan 5.3's Worker-made uid waits until Supabase is retired.
 */

export type ClaimEnv = IdentityFlagsEnv & RateLimitEnv;

/** Plan 5.3 "claim 기한을 둔다(예: 180일)", read as: until 180 days after the token's `exp`. */
export const CLAIM_WINDOW_SECONDS = 180 * 86_400;
const MAX_BODY_BYTES = 9 * 1024;

type Outcome = { response: Response; code: string };

function log(status: number, code: string): void {
  // Never log tokens, uids or bodies (STEP1_DESIGN 4.5).
  console.log(`api POST auth.claim ${status} ${code}`);
}

async function readBody(request: Request): Promise<{ ok: true; token: string | null } | { ok: false; code: ApiErrorCode }> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return { ok: false, code: "invalid" };
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false, code: "too_large" };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, code: "invalid" };
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, code: "too_large" };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, code: "invalid" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, code: "invalid" };
  const keys = Object.keys(body);
  if (keys.some((key) => key !== "access_token")) return { ok: false, code: "invalid" };
  const token = (body as { access_token?: unknown }).access_token;
  if (token === undefined || token === null) return { ok: true, token: null };
  if (typeof token !== "string" || token.length === 0) return { ok: false, code: "invalid" };
  return { ok: true, token };
}

/** Same rule as router.ts isCrossSiteWrite (copied: router.ts imports this module). */
function isCrossSite(request: Request, url: URL): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return true;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== url.origin;
}

async function respond(
  request: Request,
  url: URL,
  secret: string,
  uid: string,
  created: boolean,
  session: ClaimSession | null,
  now: number,
): Promise<Response> {
  const body: ClaimResponse = { v: 1, uid, created, session };
  const response = jsonResponse(body);
  const secure = url.protocol === "https:";
  response.headers.append("Set-Cookie", identityCookieHeader(await signIdentityCookie(secret, uid, now), secure));
  const signal = identityModeCookieHeader(readCookie(request, IDENTITY_MODE_COOKIE_NAME), "cookie", secure);
  if (signal) response.headers.append("Set-Cookie", signal);
  return response;
}

async function claimWithToken(
  token: string,
  env: ClaimEnv,
  ctx: ExecutionContextLike,
  config: SupabaseApiConfig,
  now: number,
): Promise<{ ok: true; uid: string } | { ok: false; code: ApiErrorCode }> {
  const issuer = supabaseIssuer(config);
  const keys = await verificationKeys(env, ctx);
  const check = await checkSupabaseAccessToken(token, {
    issuer,
    now,
    fetchJwks: () => fetchSupabaseJwks(issuer),
    waitUntil: (promise) => ctx.waitUntil(promise),
    pinnedKeys: keys.pinned,
    revokedKids: keys.revoked,
    ignoreExpiry: true,
    legacyHs256Secret: env.API_SUPABASE_LEGACY_JWT_SECRET || undefined,
  });
  if (!check.ok) return { ok: false, code: check.reason === "unavailable" ? "auth_unavailable" : "token_invalid" };
  if (check.user.expiresAt + CLAIM_WINDOW_SECONDS <= now) return { ok: false, code: "token_invalid" };
  if (!check.user.isAnonymous) return { ok: false, code: "forbidden" };
  return { ok: true, uid: check.user.userId };
}

async function claim(
  request: Request,
  env: ClaimEnv,
  ctx: ExecutionContextLike,
  url: URL,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  fetcher: Fetcher | undefined,
): Promise<Outcome> {
  if (request.method === "OPTIONS") {
    return { response: new Response(null, { status: 204, headers: { Allow: "OPTIONS, POST", [API_MARKER_HEADER]: "1", "Cache-Control": PRIVATE_NO_STORE } }), code: "options" };
  }
  if (request.method !== "POST") return { response: apiError("method_not_allowed", { Allow: "OPTIONS, POST" }), code: "method_not_allowed" };
  if (isCrossSite(request, url)) return { response: apiError("cross_site"), code: "cross_site" };

  const disabled = flagsDisabledReason(env);
  if (disabled) return { response: legacyResponse(disabled), code: `legacy:${disabled}` };
  const qa = qaOverride(request, env);
  if (qa.noSupabase) return { response: legacyResponse("qa"), code: "legacy:qa" };
  const secret = identitySecret(env);
  if (!secret) return { response: legacyResponse("not_configured"), code: "legacy:not_configured" };
  if (await apiIdentityMode(env, ctx, routedGroups, false) !== "cookie") {
    return { response: legacyResponse("flag"), code: "legacy:flag" };
  }

  // Claims and sign-ups count per client IP on the write budget.
  const ip = clientIp(request);
  if (!(await withinRateLimit(env, "user", ip === null ? null : `claim:${ip}`))) {
    return { response: apiError("rate_limited"), code: "rate_limited" };
  }
  const body = await readBody(request);
  if (!body.ok) return { response: apiError(body.code), code: body.code };

  const config = supabaseApiConfig(env) as SupabaseApiConfig;
  const now = Math.floor(Date.now() / 1000);

  if (body.token !== null) {
    const claimed = await claimWithToken(body.token, env, ctx, config, now);
    if (!claimed.ok) return { response: apiError(claimed.code), code: claimed.code };
    return { response: await respond(request, url, secret, claimed.uid, false, null, now), code: "claimed" };
  }

  const existing = await verifyIdentityCookie(secret, readCookie(request, IDENTITY_COOKIE_NAME), now);
  if (existing.ok) return { response: await respond(request, url, secret, existing.uid, false, null, now), code: "kept" };

  const signup = await supabaseAnonymousSignup(config, fetcher);
  if (signup.ok) return { response: await respond(request, url, secret, signup.uid, true, signup.session, now), code: "signed_up" };
  // No Worker-made uid while Supabase holds the data: answer like a failed sign-in today.
  return { response: apiError("auth_unavailable"), code: `auth_unavailable:${signup.code}` };
}

/** Handles the claim path; `fetcher` replaces the Supabase Auth fetch in specs. */
export async function handleIdentityClaim(
  request: Request,
  env: ClaimEnv,
  ctx: ExecutionContextLike,
  url: URL,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  fetcher?: Fetcher,
): Promise<Response> {
  let outcome: Outcome;
  try {
    outcome = await claim(request, env, ctx, url, routedGroups, fetcher);
  } catch {
    log(503, "exception");
    return apiError("unavailable");
  }
  if (outcome.response.status >= 300 || outcome.code !== "claimed") log(outcome.response.status, outcome.code);
  return outcome.response;
}

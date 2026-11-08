import type { ApiSurfaceGroup } from "../../../src/lib/api-surfaces";
import { IDENTITY_COOKIE_NAME, IDENTITY_MODE_COOKIE_NAME, type IdentityMode } from "../../../src/lib/identity-cookies";
import { readCookie } from "../flag-cookie";
import type { ExecutionContextLike } from "../flags";
import type { ApiErrorCode } from "../http";
import { bearerToken, checkSupabaseAccessToken, fetchSupabaseJwks, type VerifiedSupabaseUser } from "../jwt";
import { supabaseIssuer, type SupabaseApiConfig } from "../supabase-rest";
import {
  identityCookieHeader,
  identityModeCookieHeader,
  identitySecret,
  signIdentityCookie,
  verifyIdentityCookie,
} from "./cookie";
import { apiIdentityMode, type IdentityFlagsEnv } from "./mode";

/**
 * Who sends an /api/me or /api/write request (plan 5.3, 7.3 step 4).
 *
 * - `token` mode (default): today's step 1 path, unchanged. A verified
 *   Supabase bearer token; the handler forwards it so RLS checks the write.
 * - `cookie` mode: the signed `slseoun_id` cookie names the uid. A bearer token
 *   the request still carries (a tab with older JS) is verified and handed on
 *   only when it names the same uid; otherwise `token` is null. Handlers that
 *   still forward `token` then reach PostgREST as anon and RLS refuses, so turn
 *   cookie mode on only after the step 4 writes use the service key.
 */

export type RequestIdentity = {
  source: IdentityMode;
  user: VerifiedSupabaseUser;
  token: string | null;
};

export type IdentityResolution =
  | { ok: true; identity: RequestIdentity; setCookies: string[] }
  | { ok: false; code: ApiErrorCode; setCookies: string[] };

const TOKEN_ERRORS: Record<"expired" | "invalid" | "unavailable", ApiErrorCode> = {
  expired: "token_expired",
  invalid: "token_invalid",
  unavailable: "auth_unavailable",
};

async function verifiedBearer(request: Request, config: SupabaseApiConfig, ctx: ExecutionContextLike) {
  const token = bearerToken(request);
  if (!token) return { token: null, check: null };
  const issuer = supabaseIssuer(config);
  const check = await checkSupabaseAccessToken(token, {
    issuer,
    fetchJwks: () => fetchSupabaseJwks(issuer),
    waitUntil: (promise) => ctx.waitUntil(promise),
  });
  return { token, check };
}

export async function resolveRequestIdentity(
  request: Request,
  env: IdentityFlagsEnv,
  ctx: ExecutionContextLike,
  config: SupabaseApiConfig,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  qaNoSupabase: boolean,
  url: URL,
): Promise<IdentityResolution> {
  const mode = await apiIdentityMode(env, ctx, routedGroups, qaNoSupabase);
  const secure = url.protocol === "https:";
  const setCookies: string[] = [];
  const signal = identityModeCookieHeader(readCookie(request, IDENTITY_MODE_COOKIE_NAME), mode, secure);
  if (signal) setCookies.push(signal);

  if (mode === "token") {
    const { token, check } = await verifiedBearer(request, config, ctx);
    if (!token || !check) return { ok: false, code: "token_invalid", setCookies };
    if (!check.ok) return { ok: false, code: TOKEN_ERRORS[check.reason], setCookies };
    return { ok: true, identity: { source: "token", user: check.user, token }, setCookies };
  }

  const secret = identitySecret(env) as string;
  const now = Math.floor(Date.now() / 1000);
  const cookie = await verifyIdentityCookie(secret, readCookie(request, IDENTITY_COOKIE_NAME), now);
  if (!cookie.ok) return { ok: false, code: "identity_required", setCookies };
  if (cookie.renew) setCookies.push(identityCookieHeader(await signIdentityCookie(secret, cookie.uid, now), secure));

  const { token, check } = await verifiedBearer(request, config, ctx);
  const sameUser = token !== null && check?.ok === true && check.user.userId === cookie.uid;
  return {
    ok: true,
    identity: {
      source: "cookie",
      // Every Supabase identity being moved is anonymous (plan 0단계: 3,808 of 3,808).
      user: { userId: cookie.uid, isAnonymous: true, expiresAt: cookie.expiresAt },
      token: sameUser ? token : null,
    },
    setCookies,
  };
}

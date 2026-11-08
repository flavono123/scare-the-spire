import type { ExecutionContextLike } from "./flags";
import type { ApiErrorCode } from "./http";
import { bearerToken, checkSupabaseAccessToken, fetchSupabaseJwks, type VerifiedSupabaseUser } from "./jwt";
import { supabaseIssuer, type SupabaseApiConfig } from "./supabase-rest";

/**
 * Who is writing, for writes the Worker checks itself (write.<group> = worker,
 * docs/supabase-exit/STEP4_WRITE_GATE.md). The uid becomes the owner column and
 * `p_actor` of the service-key writes; nothing else of the identity is used.
 *
 * Resolvers run in order and the first that answers wins. Today there is one:
 * the Supabase access token, checked exactly as the rls path checks it. The
 * signed-cookie identity (plan 5.3) plugs in ahead of it through
 * `createApiRouter(routes, { writeIdentity: [cookieResolver, bearerWriteIdentity] })`.
 */

export type WriteIdentity =
  | {
      ok: true;
      user: VerifiedSupabaseUser;
      /** The bearer token when the request carried one; never forwarded in worker mode. */
      token: string | null;
      source: "bearer" | "cookie";
    }
  | { ok: false; code: ApiErrorCode };

export type WriteIdentityContext = {
  config: SupabaseApiConfig;
  ctx: ExecutionContextLike;
};

/** null: this resolver finds no identity on the request (the next one is asked). */
export type WriteIdentityResolver = (request: Request, context: WriteIdentityContext) => Promise<WriteIdentity | null>;

const TOKEN_ERRORS: Record<"expired" | "invalid" | "unavailable", ApiErrorCode> = {
  expired: "token_expired",
  invalid: "token_invalid",
  unavailable: "auth_unavailable",
};

export const bearerWriteIdentity: WriteIdentityResolver = async (request, { config, ctx }) => {
  const token = bearerToken(request);
  if (!token) return null;
  const issuer = supabaseIssuer(config);
  const check = await checkSupabaseAccessToken(token, {
    issuer,
    fetchJwks: () => fetchSupabaseJwks(issuer),
    waitUntil: (promise) => ctx.waitUntil(promise),
  });
  if (!check.ok) return { ok: false, code: TOKEN_ERRORS[check.reason] };
  return { ok: true, user: check.user, token, source: "bearer" };
};

export const DEFAULT_WRITE_IDENTITY: readonly WriteIdentityResolver[] = [bearerWriteIdentity];

export async function resolveWriteIdentity(
  resolvers: readonly WriteIdentityResolver[],
  request: Request,
  context: WriteIdentityContext,
): Promise<WriteIdentity> {
  for (const resolve of resolvers) {
    const identity = await resolve(request, context);
    if (identity) return identity;
  }
  return { ok: false, code: "token_invalid" };
}

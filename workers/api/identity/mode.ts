import type { ApiSurfaceGroup } from "../../../src/lib/api-surfaces";
import { IDENTITY_MODE_KEY, parseIdentityMode, type IdentityMode } from "../../../src/lib/identity-cookies";
import {
  apiFlags,
  flagsDisabledReason,
  FRESH_MS,
  rememberedFlagValues,
  type ExecutionContextLike,
  type FlagsEnv,
} from "../flags";
import { identitySecret, type IdentityEnv } from "./cookie";

/**
 * The `identity.mode` runtime flag: `token` (default, step 1 bearer tokens and
 * RLS) or `cookie` (step 4 signed cookie). Anything that keeps the flags off
 * (the kill switch, bad config, a missing cookie secret, QA no-supabase) means
 * `token`, the safe side for every step before 4 (plan 7.2). Callers pass the
 * QA no-supabase bit so this module does not import flag-cookie.ts.
 */

export type IdentityFlagsEnv = FlagsEnv & IdentityEnv;

function modeFrom(values: ReadonlyMap<string, string> | null): IdentityMode {
  return parseIdentityMode(values?.get(IDENTITY_MODE_KEY));
}

/** True when nothing outside the flag itself keeps identity on the token path. */
function cookieModePossible(env: IdentityFlagsEnv, qaNoSupabase: boolean): boolean {
  return !flagsDisabledReason(env) && identitySecret(env) !== null && !qaNoSupabase;
}

/**
 * Mode for an /api request. Uses a value no older than FRESH_MS, reading the
 * flags when this isolate has none (the QA-pinned path skips that read); a
 * failed read means token.
 */
export async function apiIdentityMode(
  env: IdentityFlagsEnv,
  ctx: ExecutionContextLike,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  qaNoSupabase: boolean,
  now = Date.now(),
): Promise<IdentityMode> {
  if (!cookieModePossible(env, qaNoSupabase)) return "token";
  let values = rememberedFlagValues(now, FRESH_MS);
  if (!values) {
    const decision = await apiFlags(env, ctx, routedGroups);
    if (!decision.ok) return "token";
    values = rememberedFlagValues(Date.now(), FRESH_MS);
  }
  return modeFrom(values);
}

/** Mode for a page response from memory only, or null when unknown (leave the cookie alone). */
export function pageIdentityMode(env: IdentityFlagsEnv, qaNoSupabase: boolean, now = Date.now()): IdentityMode | null {
  if (!cookieModePossible(env, qaNoSupabase)) return "token";
  const values = rememberedFlagValues(now);
  return values ? modeFrom(values) : null;
}

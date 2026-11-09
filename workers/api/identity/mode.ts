import type { ApiSurfaceGroup } from "../../../src/lib/api-surfaces";
import { IDENTITY_MODE_KEY, IDENTITY_MODES, type IdentityMode } from "../../../src/lib/identity-cookies";
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
 * The `identity.mode` runtime flag: `token` (step 1 bearer tokens and RLS) or
 * `cookie` (step 4 signed cookie). Anything that keeps the flags off (the kill
 * switch, bad config, a missing cookie secret, QA no-supabase) means `token`,
 * the safe side for every step before 4 (plan 7.2). A missing row, a value that
 * is neither mode, or a failed flags read means API_IDENTITY_MODE_DEFAULT:
 * `token` unless the deploy sets `cookie`. The step 6 browser has no token path,
 * so there the safe side is `cookie` (docs/supabase-exit/STEP6_PLAN.md 2, P12).
 * Callers pass the QA no-supabase bit so this module does not import flag-cookie.ts.
 */

export type IdentityFlagsEnv = FlagsEnv & IdentityEnv & {
  /** "cookie" once the browser has no token path (step 6); anything else means "token". */
  API_IDENTITY_MODE_DEFAULT?: string;
};

export function defaultIdentityMode(env: IdentityFlagsEnv): IdentityMode {
  return env.API_IDENTITY_MODE_DEFAULT === "cookie" ? "cookie" : "token";
}

function modeFrom(values: ReadonlyMap<string, string>, fallback: IdentityMode): IdentityMode {
  const value = values.get(IDENTITY_MODE_KEY);
  return (IDENTITY_MODES as readonly (string | undefined)[]).includes(value) ? value as IdentityMode : fallback;
}

/** True when nothing outside the flag itself keeps identity on the token path. */
function cookieModePossible(env: IdentityFlagsEnv, qaNoSupabase: boolean): boolean {
  return !flagsDisabledReason(env) && identitySecret(env) !== null && !qaNoSupabase;
}

/**
 * Mode for an /api request. Uses a value no older than FRESH_MS, reading the
 * flags when this isolate has none (the QA-pinned path skips that read); a
 * failed read means the env default.
 */
export async function apiIdentityMode(
  env: IdentityFlagsEnv,
  ctx: ExecutionContextLike,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  qaNoSupabase: boolean,
  now = Date.now(),
): Promise<IdentityMode> {
  if (!cookieModePossible(env, qaNoSupabase)) return "token";
  const fallback = defaultIdentityMode(env);
  let values = rememberedFlagValues(now, FRESH_MS);
  if (!values) {
    const decision = await apiFlags(env, ctx, routedGroups);
    if (!decision.ok) return fallback;
    values = rememberedFlagValues(Date.now(), FRESH_MS);
  }
  return values ? modeFrom(values, fallback) : fallback;
}

/**
 * Mode for a page response from memory only. Unknown (this isolate has not read
 * the flags yet) is the env default when that is `cookie`, like pageFlags with
 * API_PATH_DEFAULT=api; otherwise null (leave the cookie alone).
 */
export function pageIdentityMode(env: IdentityFlagsEnv, qaNoSupabase: boolean, now = Date.now()): IdentityMode | null {
  if (!cookieModePossible(env, qaNoSupabase)) return "token";
  const fallback = defaultIdentityMode(env);
  const values = rememberedFlagValues(now);
  if (values) return modeFrom(values, fallback);
  return fallback === "cookie" ? "cookie" : null;
}

/**
 * Step 4 signed-cookie identity (docs/SUPABASE_EXIT_PLAN.md 5.3, 7.3 step 4),
 * shared by the Worker, the browser and scripts/runtime-flags.ts, so keep it
 * free of imports.
 *
 * - `slseoun_id` (HttpOnly, Path=/api/): the signed uid. Only the Worker reads it.
 * - `slseoun_idm` (readable): `cookie` while the `identity.mode` runtime flag is
 *   `cookie`. The browser then claims once and stops sending the Supabase bearer
 *   token. Absent means today's bearer token path. The step 6 clients (WP-A, WP-P)
 *   no longer read it; the Worker keeps sending it for an older client after a rollback.
 */

/** D1 runtime_flags key; `token` (default, today) or `cookie`. */
export const IDENTITY_MODE_KEY = "identity.mode";

export const IDENTITY_MODES = ["token", "cookie"] as const;

export type IdentityMode = (typeof IDENTITY_MODES)[number];

export function parseIdentityMode(value: unknown): IdentityMode {
  return value === "cookie" ? "cookie" : "token";
}

export const IDENTITY_COOKIE_NAME = "slseoun_id";
export const IDENTITY_COOKIE_PATH = "/api/";

export const IDENTITY_MODE_COOKIE_NAME = "slseoun_idm";
export const IDENTITY_MODE_COOKIE_VALUE = "cookie";

export const IDENTITY_CLAIM_PATH = "/api/auth/claim";

/** localStorage key where the browser remembers the uid it claimed (the cookie itself is HttpOnly). */
export const IDENTITY_MARKER_STORAGE_KEY = "slseoun-identity";

/**
 * Body of `POST /api/auth/claim`, the step 6 contract (docs/supabase-exit/STEP6_PLAN.md WP0)
 * that the Worker (WP-A, workers/api/identity/claim.ts) and both browser clients
 * (WP-A src/lib/api-identity.ts, WP-P the patch static client) keep:
 *
 * - `access_token`: the Supabase access token stored under `sb-<ref>-auth-token`
 *   (expired is fine within the claim window). The Worker claims its uid.
 * - `refresh_token`: the same stored session's refresh token, sent along with
 *   `access_token`. The Worker uses it only when the access token is refused as
 *   `token_invalid` (past the claim window, or HS256 without the legacy secret):
 *   it refreshes the session on Supabase Auth, claims that uid and answers the new
 *   session. A refused refresh is 401 `token_invalid`, an Auth outage 503 `auth_unavailable`.
 * - `{}` (neither): no stored session. The Worker keeps a valid cookie's uid
 *   (`created: false`, no session) or signs up a new user (`created: true`, with
 *   the session). A client whose token claim answered 401 `token_invalid` sends
 *   `{}` once.
 *
 * Only a Worker with the WP-A refresh path takes `refresh_token`; an older one
 * answers a body with any key but `access_token` 400 `invalid`.
 */
export type ClaimRequest = {
  access_token?: string;
  refresh_token?: string;
};

/**
 * Supabase session the claim answers (supabase-js v2 storage shape). The client
 * stores it as is under `sb-<ref>-auth-token` (the existing key, or one made from
 * the host of the access token's `iss`) so a rollback finds the same uid (plan 5.3).
 */
export type ClaimSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  /** Supabase's user object as sign-up returned it; supabase-js stores it with the session. */
  user: Record<string, unknown>;
};

export type ClaimResponse = {
  v: 1;
  uid: string;
  /** True when this call made the identity (new user). */
  created: boolean;
  /**
   * Present for a new user signed up on Supabase and after a refresh claim
   * succeeded; null or absent otherwise (a token claim, a kept cookie).
   */
  session?: ClaimSession | null;
};

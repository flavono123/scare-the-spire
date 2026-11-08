/**
 * Step 4 signed-cookie identity (docs/SUPABASE_EXIT_PLAN.md 5.3, 7.3 step 4),
 * shared by the Worker, the browser and scripts/runtime-flags.ts, so keep it
 * free of imports.
 *
 * - `slseoun_id` (HttpOnly, Path=/api/): the signed uid. Only the Worker reads it.
 * - `slseoun_idm` (readable): `cookie` while the `identity.mode` runtime flag is
 *   `cookie`. The browser then claims once and stops sending the Supabase bearer
 *   token. Absent means today's bearer token path.
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

/** Supabase session handed to a new user so supabase-js holds the same uid (plan 5.3). */
export type ClaimSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
};

export type ClaimResponse = {
  v: 1;
  uid: string;
  /** True when this call made the identity (new user). */
  created: boolean;
  /** Only for a new user signed up on Supabase; null otherwise. */
  session: ClaimSession | null;
};

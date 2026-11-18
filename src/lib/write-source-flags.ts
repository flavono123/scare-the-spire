/**
 * Step 5 runtime flags (docs/SUPABASE_EXIT_PLAN.md 7.3 step 5, docs/supabase-exit/D1_SCHEMA_DESIGN.md
 * 5.5): the write source per screen group and the cutover pause. Shared by the Worker, the browser
 * client and scripts/runtime-flags.ts, so keep it free of runtime imports.
 *
 * - `source.<group>` = supabase | d1. Missing means supabase (today's behaviour).
 * - `write.paused` = off | on. While on, every /api/write/* answers 503 `write_paused` with
 *   Retry-After; the client resends after that delay. Missing means off.
 *
 * The cutover script flips every write group together: the data behind the groups is shared
 * (a comment recounts a post), so a mix of sources is not a supported state.
 */
import type { ApiSurfaceGroup } from "./api-surfaces";

/** Groups that have /api/write routes. */
export const WRITE_GROUPS = [
  "comments",
  "stories",
  "toybox-feed",
  "history-runs",
  "puzzlebox",
  "profile",
  "contact",
] as const satisfies readonly ApiSurfaceGroup[];

export type WriteGroup = (typeof WRITE_GROUPS)[number];

export const WRITE_SOURCES = ["supabase", "d1"] as const;
export type WriteSource = (typeof WRITE_SOURCES)[number];

export const WRITE_PAUSED_KEY = "write.paused";
export const WRITE_PAUSED_VALUES = ["off", "on"] as const;

/** Error code of the 503 a paused write gets; the only 503 the client resends. */
export const WRITE_PAUSED_ERROR = "write_paused";
export const WRITE_PAUSED_RETRY_AFTER_SECONDS = 3;

export function isWriteGroup(value: unknown): value is WriteGroup {
  return typeof value === "string" && (WRITE_GROUPS as readonly string[]).includes(value);
}

/** D1 key of a group's write source flag. */
export function sourceFlagKey(group: WriteGroup): string {
  return `source.${group}`;
}

/**
 * Step 7 switch (docs/SUPABASE_EXIT_PLAN.md 7.3): `off` retires Supabase. The outbox stops mirroring to it,
 * new identities get a Worker-made uid (no Supabase sign-up), and expired Supabase sessions are not refreshed.
 * Unset or `on` keeps step 5/6 behavior. The two go together: a Worker-made uid is not in Supabase's
 * auth.users, so mirroring its rows would fail their foreign keys.
 */
// shortcut: while off the D1 writes still add outbox rows (a few dozen a day); drop them in the step 7 code cleanup.
export const MIRROR_FLAG_KEY = "mirror.enabled";
export const MIRROR_FLAG_VALUES = ["on", "off"] as const;

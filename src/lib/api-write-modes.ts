/**
 * Step 4 of the Supabase exit (docs/SUPABASE_EXIT_PLAN.md 7.3): who checks a
 * write before it reaches Supabase. "rls" is today: the Worker forwards the
 * user's Supabase token and RLS, guard triggers and grants decide. "worker":
 * the Worker checks ownership, guard columns and grants itself and writes with
 * the service key (docs/supabase-exit/STEP4_WRITE_GATE.md). Shared by the
 * Worker and scripts/runtime-flags.ts, so keep it free of imports.
 */

/** Groups that have /api/write routes; the others have nothing to switch. */
export const WRITE_FLAG_GROUPS = [
  "comments",
  "toybox-feed",
  "stories",
  "history-runs",
  "puzzlebox",
  "profile",
  "contact",
] as const;

export type WriteFlagGroup = (typeof WRITE_FLAG_GROUPS)[number];

export type WriteMode = "rls" | "worker";

export const WRITE_MODES: readonly WriteMode[] = ["rls", "worker"];

export function isWriteMode(value: unknown): value is WriteMode {
  return value === "rls" || value === "worker";
}

export function isWriteFlagGroup(value: unknown): value is WriteFlagGroup {
  return typeof value === "string" && (WRITE_FLAG_GROUPS as readonly string[]).includes(value);
}

/** D1 key of a group's write flag. */
export function writeFlagKey(group: WriteFlagGroup): string {
  return `write.${group}`;
}

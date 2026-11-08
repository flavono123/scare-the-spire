/**
 * The keys scripts/runtime-flags.ts may set, each with the values it accepts. Kept apart from the
 * script (which runs wrangler on import) so specs can check the rules.
 */
import { API_SURFACE_GROUPS, READ_STORES, SURFACE_PATHS, pathFlagKey, readFlagKey, shadowFlagKey } from "../src/lib/api-surfaces";
import { WRITE_FLAG_GROUPS, WRITE_MODES, writeFlagKey } from "../src/lib/api-write-modes";
import { IDENTITY_MODE_KEY, IDENTITY_MODES } from "../src/lib/identity-cookies";
import { WRITE_GROUPS, WRITE_PAUSED_KEY, WRITE_PAUSED_VALUES, WRITE_SOURCES, sourceFlagKey } from "../src/lib/write-source-flags";
import { SYNC_FLAG_KEY, SYNC_FLAG_VALUES } from "../workers/sync/sync-env";

export type KeyRule = { values: string; accepts: (value: string) => boolean };

const PATH_RULE: KeyRule = { values: SURFACE_PATHS.join(", "), accepts: (value) => SURFACE_PATHS.includes(value as never) };
// A decimal from 0 to 1 with at most 4 fraction digits; the Worker also clamps what it reads.
const SHADOW_RULE: KeyRule = {
  values: "a rate from 0 to 1 (e.g. 0, 0.1, 1)",
  accepts: (value) => /^[01](?:\.\d{1,4})?$/.test(value) && Number(value) <= 1,
};

export const oneOf = (values: readonly string[]): KeyRule => ({ values: values.join(", "), accepts: (value) => values.includes(value) });

export const KNOWN_KEYS: ReadonlyMap<string, KeyRule> = new Map<string, KeyRule>([
  ...API_SURFACE_GROUPS.map((group) => [pathFlagKey(group), PATH_RULE] as const),
  ...API_SURFACE_GROUPS.map((group) => [shadowFlagKey(group), SHADOW_RULE] as const),
  // Step 3 (docs/SUPABASE_EXIT_PLAN.md 7.3): the store a group's GET routes read; missing = supabase.
  ...API_SURFACE_GROUPS.map((group) => [readFlagKey(group), oneOf(READ_STORES)] as const),
  // Step 2: the 1-minute sync and read-after-write (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.3).
  [SYNC_FLAG_KEY, oneOf(SYNC_FLAG_VALUES)],
  // Step 4 identity (docs/SUPABASE_EXIT_PLAN.md 5.3): token is step 1, cookie the signed cookie.
  [IDENTITY_MODE_KEY, oneOf(IDENTITY_MODES)],
  // Step 4 (docs/supabase-exit/STEP4_WRITE_GATE.md): rls = today, worker = Worker checks and the service key.
  ...WRITE_FLAG_GROUPS.map((group) => [writeFlagKey(group), oneOf(WRITE_MODES)] as const),
  // Step 5 (docs/SUPABASE_EXIT_PLAN.md 7.3): the write source per group and the cutover pause.
  ...WRITE_GROUPS.map((group) => [sourceFlagKey(group), oneOf(WRITE_SOURCES)] as const),
  [WRITE_PAUSED_KEY, oneOf(WRITE_PAUSED_VALUES)],
]);

export type FlagSetCheck = { ok: true } | { ok: false; message: string };

/** Whether `set <key> <value>` may run against the target (before any wrangler call). */
export function checkFlagSet(
  key: string | undefined,
  value: string | undefined,
  target: { env: "testbed" | "production"; remote: boolean; confirmProduction: boolean },
): FlagSetCheck {
  const rule = key ? KNOWN_KEYS.get(key) : undefined;
  if (!rule) return { ok: false, message: `unknown key: ${key}` };
  if (!value || !rule.accepts(value)) return { ok: false, message: `value for ${key} must be ${rule.values}` };
  if (target.env === "production" && target.remote && !target.confirmProduction) {
    return { ok: false, message: "changing production needs --confirm-production (after the user approves)" };
  }
  return { ok: true };
}

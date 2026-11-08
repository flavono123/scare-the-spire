import { withTimeout, type D1Database } from "../api/d1";
import type { FlagsEnv } from "../api/flags";
import type { ApiDataEnv, SupabaseApiConfig } from "../api/supabase-rest";

/**
 * Switches and the Supabase service-key config of the step-2 sync and read-after-write
 * (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.3). Everything is inert unless the master var
 * API_RUNTIME_FLAGS is "d1" and runtime_flags holds sync.enabled = on.
 */

export type SyncEnv = FlagsEnv & {
  /**
   * Supabase secret key (sb_secret_...), a Worker secret. Only the sync and read-after-write use
   * it: d1_change_log is readable by the service role only, and re-reads must see every column.
   */
  API_SUPABASE_SECRET_KEY?: string;
};

export const SYNC_FLAG_KEY = "sync.enabled";
export const SYNC_FLAG_VALUES = ["on", "off"] as const;

export const SYNC_FLAG_SQL = "SELECT value FROM runtime_flags WHERE key = 'sync.enabled'";

/** Why the sync cannot run in this isolate at all, before reading D1. */
export function syncDisabledReason(env: SyncEnv): "off" | null {
  return env.API_RUNTIME_FLAGS === "d1" && env.DB ? null : "off";
}

/** The service-key PostgREST config, or null when a var is missing or malformed. */
export function supabaseServiceConfig(env: SyncEnv): SupabaseApiConfig | null {
  const url = (env.API_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.API_SUPABASE_SECRET_KEY ?? "").trim();
  const dataEnv = (env.API_DATA_ENV ?? "").trim();
  // The same URL rule as supabaseApiConfig: a project URL, or a local stub server.
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url) && !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url)) {
    return null;
  }
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return null;
  if (dataEnv !== "production" && dataEnv !== "development") return null;
  return { url, key, dataEnv: dataEnv as ApiDataEnv };
}

// Read-after-write checks the flag on write requests; the isolate keeps the last read like
// workers/api/flags.ts (FRESH_MS) so a burst of writes costs one D1 read per 30 s.
const FLAG_FRESH_MS = 30_000;
const FLAG_WAIT_MS = 1_000;
let flagMemory: { on: boolean; readAt: number } | null = null;

export function resetSyncFlagForTest(): void {
  flagMemory = null;
}

export async function readSyncFlag(db: D1Database): Promise<boolean> {
  const row = await db.prepare(SYNC_FLAG_SQL).first<{ value?: unknown }>();
  return row?.value === "on";
}

/** sync.enabled for a request; a failed or slow read counts as off (read-after-write is best effort). */
export async function syncFlagOn(env: SyncEnv, now = Date.now()): Promise<boolean> {
  if (syncDisabledReason(env)) return false;
  if (flagMemory && now - flagMemory.readAt < FLAG_FRESH_MS) return flagMemory.on;
  try {
    const on = await withTimeout(readSyncFlag(env.DB as D1Database), FLAG_WAIT_MS);
    flagMemory = { on, readAt: now };
    return on;
  } catch {
    flagMemory = { on: false, readAt: now };
    return false;
  }
}

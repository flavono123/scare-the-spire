import {
  API_SURFACE_GROUPS,
  isApiSurfaceGroup,
  pathFlagKey,
  type ApiSurfaceGroup,
} from "../../src/lib/api-surfaces";
import { withTimeout, type D1Database, type D1PreparedStatement } from "./d1";
import { supabaseApiConfig, type SupabaseApiEnv } from "./supabase-rest";

/**
 * Runtime path flags (docs/supabase-exit/STEP1_DESIGN.md 3.2). The isolate keeps
 * the last good read. Page requests never wait for D1; /api requests never use
 * a value older than FRESH_MS.
 */

export type FlagsEnv = SupabaseApiEnv & {
  DB?: D1Database;
  /** "d1" turns the flags on; anything else keeps every group legacy without reading D1. */
  API_RUNTIME_FLAGS?: string;
};

export type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

export const FRESH_MS = 30_000;
export const STALE_MAX_MS = 5 * 60_000;
export const PAGE_REFRESH_GUARD_MS = 2_000;
export const API_FLAG_WAIT_MS = 1_000;
const FAILURE_BACKOFF_MS = [10_000, 30_000, 60_000];

const EMPTY: ReadonlySet<ApiSurfaceGroup> = new Set();

type FlagMemory = {
  groups: ReadonlySet<ApiSurfaceGroup>;
  readAt: number;
};

let memory: FlagMemory | null = null;
let refreshGuardUntil = 0;
let failures = 0;
let retryAt = 0;

export function resetFlagsForTest(): void {
  memory = null;
  refreshGuardUntil = 0;
  failures = 0;
  retryAt = 0;
}

export const FLAGS_SQL = "SELECT key, value FROM runtime_flags";

export function flagsStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(FLAGS_SQL);
}

/** Groups on the api path, limited to groups this Worker version has routes for. */
export function parseFlagRows(
  rows: readonly { key?: unknown; value?: unknown }[],
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
): Set<ApiSurfaceGroup> {
  const groups = new Set<ApiSurfaceGroup>();
  for (const group of API_SURFACE_GROUPS) {
    if (!routedGroups.has(group)) continue;
    const row = rows.find((candidate) => candidate.key === pathFlagKey(group));
    if (row?.value === "api") groups.add(group);
  }
  return groups;
}

export function recordFlags(groups: ReadonlySet<ApiSurfaceGroup>, now: number): void {
  memory = { groups, readAt: now };
  failures = 0;
  retryAt = 0;
}

export function recordFlagFailure(now: number): void {
  failures += 1;
  retryAt = now + FAILURE_BACKOFF_MS[Math.min(failures, FAILURE_BACKOFF_MS.length) - 1];
}

/** Why the flags cannot turn anything on in this isolate, or null when they can. */
export function flagsDisabledReason(env: FlagsEnv): "off" | "not_configured" | null {
  if (env.API_RUNTIME_FLAGS !== "d1" || !env.DB) return "off";
  if (!supabaseApiConfig(env)) return "not_configured";
  return null;
}

async function readFlags(db: D1Database, routedGroups: ReadonlySet<ApiSurfaceGroup>, now: () => number) {
  try {
    const result = await flagsStatement(db).all<{ key: string; value: string }>();
    const groups = parseFlagRows(result.results ?? [], routedGroups);
    recordFlags(groups, now());
    return groups;
  } catch (error) {
    recordFlagFailure(now());
    throw error;
  }
}

/**
 * Flags for a page request: known groups, or null when this isolate does not
 * know them yet (then the caller leaves the client's cookie alone). Never waits.
 */
export function pageFlags(
  env: FlagsEnv,
  ctx: ExecutionContextLike,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  now = Date.now(),
): ReadonlySet<ApiSurfaceGroup> | null {
  if (flagsDisabledReason(env)) return EMPTY;
  const age = memory ? now - memory.readAt : Infinity;
  if (age >= FRESH_MS && now >= refreshGuardUntil && now >= retryAt) {
    refreshGuardUntil = now + PAGE_REFRESH_GUARD_MS;
    ctx.waitUntil(readFlags(env.DB as D1Database, routedGroups, Date.now).catch(() => undefined));
  }
  if (memory && age < STALE_MAX_MS) return memory.groups;
  return null;
}

export type ApiFlagDecision =
  | { ok: true; groups: ReadonlySet<ApiSurfaceGroup>; prefetched: unknown[] }
  | { ok: false; reason: "off" | "not_configured" | "unknown" };

/**
 * Flags for an /api request. A value older than FRESH_MS is re-read (at most
 * API_FLAG_WAIT_MS); `extra` statements ride in the same D1 batch so public
 * reads pay one round trip. Failure means legacy.
 */
export async function apiFlags(
  env: FlagsEnv,
  ctx: ExecutionContextLike,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  extra: (db: D1Database) => D1PreparedStatement[] = () => [],
  now = Date.now(),
): Promise<ApiFlagDecision> {
  const disabled = flagsDisabledReason(env);
  if (disabled) return { ok: false, reason: disabled };
  const db = env.DB as D1Database;
  if (memory && now - memory.readAt < FRESH_MS) {
    return { ok: true, groups: memory.groups, prefetched: [] };
  }
  if (now < retryAt) return { ok: false, reason: "unknown" };

  const statements = [flagsStatement(db), ...extra(db)];
  const batch = (async () => {
    try {
      const results = await db.batch(statements);
      const groups = parseFlagRows((results[0]?.results ?? []) as { key?: unknown; value?: unknown }[], routedGroups);
      recordFlags(groups, Date.now());
      return { groups, prefetched: results.slice(1).map((result) => result.results ?? []) };
    } catch (error) {
      recordFlagFailure(Date.now());
      throw error;
    }
  })();
  ctx.waitUntil(batch.catch(() => undefined));
  try {
    const { groups, prefetched } = await withTimeout(batch, API_FLAG_WAIT_MS);
    return { ok: true, groups, prefetched };
  } catch {
    return { ok: false, reason: "unknown" };
  }
}

export function isGroupOn(groups: ReadonlySet<ApiSurfaceGroup>, group: string): boolean {
  return isApiSurfaceGroup(group) && groups.has(group);
}

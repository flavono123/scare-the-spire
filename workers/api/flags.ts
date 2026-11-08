import {
  API_SURFACE_GROUPS,
  pathFlagKey,
  shadowFlagKey,
  type ApiSurfaceGroup,
} from "../../src/lib/api-surfaces";
import { withTimeout, type D1Database, type D1PreparedStatement } from "./d1";
import { supabaseApiConfig, type SupabaseApiEnv } from "./supabase-rest";
import { defaultSurfacePath, type SurfacePath } from "./path-default";

/**
 * Runtime path flags (docs/supabase-exit/STEP1_DESIGN.md 3.2). The isolate keeps
 * the last good read. Page requests never wait for D1; /api requests never use
 * a value older than FRESH_MS.
 */

export type FlagsEnv = SupabaseApiEnv & {
  DB?: D1Database;
  /** "d1" turns the flags on; anything else keeps every group legacy without reading D1. */
  API_RUNTIME_FLAGS?: string;
  /** legacy|api for a group with no usable path flag (path-default.ts); unset is legacy. */
  API_PATH_DEFAULT?: string;
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
const NO_SHADOW: ReadonlyMap<ApiSurfaceGroup, number> = new Map();

/** Step 2 shadow-read sample rate per group (D1_SCHEMA_DESIGN 6); a missing group is 0. */
export type ShadowRates = ReadonlyMap<ApiSurfaceGroup, number>;

type FlagMemory = {
  groups: ReadonlySet<ApiSurfaceGroup>;
  shadow: ShadowRates;
  readAt: number;
  /** Every row of the read, for flags that are not path flags (identity.mode). */
  values: ReadonlyMap<string, string>;
};

let memory: FlagMemory | null = null;
let refreshGuardUntil = 0;
let failures = 0;
let retryAt = 0;
let lastFailureAt = -Infinity;

export function resetFlagsForTest(): void {
  memory = null;
  refreshGuardUntil = 0;
  failures = 0;
  retryAt = 0;
  lastFailureAt = -Infinity;
}

export const FLAGS_SQL = "SELECT key, value FROM runtime_flags";

export function flagsStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(FLAGS_SQL);
}

/**
 * Groups on the api path, limited to groups this Worker version has routes for. A group without
 * a `legacy` or `api` row takes `fallback` (API_PATH_DEFAULT).
 */
export function parseFlagRows(
  rows: readonly { key?: unknown; value?: unknown }[],
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  fallback: SurfacePath = "legacy",
): Set<ApiSurfaceGroup> {
  const groups = new Set<ApiSurfaceGroup>();
  for (const group of API_SURFACE_GROUPS) {
    if (!routedGroups.has(group)) continue;
    const row = rows.find((candidate) => candidate.key === pathFlagKey(group));
    if (row?.value === "api" || (fallback === "api" && row?.value !== "legacy")) groups.add(group);
  }
  return groups;
}

/**
 * `shadow.<group>` sample rates of routed groups: a number clamped to 0..1. Missing, empty or
 * non-numeric values are 0 and are left out.
 */
export function parseShadowRates(
  rows: readonly { key?: unknown; value?: unknown }[],
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
): Map<ApiSurfaceGroup, number> {
  const rates = new Map<ApiSurfaceGroup, number>();
  for (const group of API_SURFACE_GROUPS) {
    if (!routedGroups.has(group)) continue;
    const row = rows.find((candidate) => candidate.key === shadowFlagKey(group));
    const rate = clampShadowRate(row?.value);
    if (rate > 0) rates.set(group, rate);
  }
  return rates;
}

export function clampShadowRate(value: unknown): number {
  const text = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  if (!text) return 0;
  const rate = Number(text);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return rate >= 1 ? 1 : rate;
}

/** String-valued rows of a flags read, by key. */
export function flagValues(rows: readonly { key?: unknown; value?: unknown }[]): Map<string, string> {
  const values = new Map<string, string>();
  for (const row of rows) {
    if (typeof row.key === "string" && typeof row.value === "string") values.set(row.key, row.value);
  }
  return values;
}

export function recordFlags(
  groups: ReadonlySet<ApiSurfaceGroup>,
  now: number,
  shadow: ShadowRates = NO_SHADOW,
  values: ReadonlyMap<string, string> = new Map(),
): void {
  memory = { groups, shadow, readAt: now, values };
  failures = 0;
  retryAt = 0;
}

/**
 * Counts one failure per read attempt: reads that started before an already
 * recorded failure overlapped it and do not escalate the backoff again.
 */
export function recordFlagFailure(startedAt: number, now: number): void {
  if (lastFailureAt >= startedAt) return;
  lastFailureAt = now;
  failures += 1;
  retryAt = now + FAILURE_BACKOFF_MS[Math.min(failures, FAILURE_BACKOFF_MS.length) - 1];
}

/** Why the flags cannot turn anything on in this isolate, or null when they can. */
export function flagsDisabledReason(env: FlagsEnv): "off" | "not_configured" | null {
  if (env.API_RUNTIME_FLAGS !== "d1" || !env.DB) return "off";
  if (!supabaseApiConfig(env)) return "not_configured";
  return null;
}

async function readFlags(
  db: D1Database,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  now: () => number,
  fallback: SurfacePath = "legacy",
) {
  const startedAt = now();
  try {
    const result = await flagsStatement(db).all<{ key: string; value: string }>();
    const groups = parseFlagRows(result.results ?? [], routedGroups, fallback);
    recordFlags(groups, now(), parseShadowRates(result.results ?? [], routedGroups), flagValues(result.results ?? []));
    return groups;
  } catch (error) {
    recordFlagFailure(startedAt, now());
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
    ctx.waitUntil(readFlags(env.DB as D1Database, routedGroups, Date.now, defaultSurfacePath(env)).catch(() => undefined));
  }
  if (memory && age < STALE_MAX_MS) return memory.groups;
  // Unknown here: with API_PATH_DEFAULT=api the page says api rather than leaving a cookie-less browser on legacy.
  return defaultSurfacePath(env) === "api" ? routedGroups : null;
}

/**
 * Every flag value of this isolate's last good read, or null when it has none
 * younger than `maxAgeMs` (page requests accept STALE_MAX_MS, /api FRESH_MS).
 */
export function rememberedFlagValues(now = Date.now(), maxAgeMs = STALE_MAX_MS): ReadonlyMap<string, string> | null {
  if (!memory || now - memory.readAt >= maxAgeMs) return null;
  return memory.values;
}

export type ApiFlagDecision =
  | { ok: true; groups: ReadonlySet<ApiSurfaceGroup>; prefetched: unknown[]; shadow: ShadowRates }
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
    return { ok: true, groups: memory.groups, prefetched: [], shadow: memory.shadow };
  }
  if (now < retryAt) return { ok: false, reason: "unknown" };

  const statements = [flagsStatement(db), ...extra(db)];
  const startedAt = Date.now();
  const batch = (async () => {
    try {
      const results = await db.batch(statements);
      const flagRows = (results[0]?.results ?? []) as { key?: unknown; value?: unknown }[];
      const groups = parseFlagRows(flagRows, routedGroups, defaultSurfacePath(env));
      const shadow = parseShadowRates(flagRows, routedGroups);
      recordFlags(groups, Date.now(), shadow, flagValues(flagRows));
      return { groups, shadow, prefetched: results.slice(1).map((result) => result.results ?? []) };
    } catch (error) {
      recordFlagFailure(startedAt, Date.now());
      throw error;
    }
  })();
  ctx.waitUntil(batch.catch(() => undefined));
  try {
    const { groups, prefetched, shadow } = await withTimeout(batch, API_FLAG_WAIT_MS);
    return { ok: true, groups, prefetched, shadow };
  } catch {
    return { ok: false, reason: "unknown" };
  }
}

import { courierCommentText } from "../../../src/lib/courier-comment-text";
import {
  kstWeekStart,
  NAV_TABLE_SURFACES,
  NAV_WEEKLY_SURFACE,
  type NavTableSurfaceId,
} from "../../../src/lib/nav-surfaces";
import { withTimeout, type D1Database } from "../d1";
import { apiError, jsonResponse } from "../http";
import type { PublicRoute, PublicRouteContext } from "../router";
import {
  inWaves,
  postgrest,
  READ_TIMEOUT_MS,
  type ApiDataEnv,
  type Fetcher,
  type RestResult,
  type SupabaseApiConfig,
} from "../supabase-rest";

/**
 * GET /api/read/nav: the latest post time of each nav surface plus the comment
 * courier (docs/supabase-exit/STEP1_DESIGN.md 8). Supabase stays the source.
 * One D1 row (`api_cache`, key `nav`) is a cache shared by every isolate, and a
 * lease lets one isolate refresh it, so Supabase sees at most one refresh a
 * minute however many crawlers arrive.
 */

export type NavCourierItem = { id: string; storyId: string; text: string; createdAt: string };

export type NavSnapshotBody = {
  v: 1;
  env: ApiDataEnv;
  fetchedAt: string;
  latest: Record<NavTableSurfaceId, string | null>;
  weekly: { "colorful-philosophers": string | null };
  courier: NavCourierItem[];
};

type SnapshotRow = {
  body: string;
  fetched_at: number;
  lease_until: number;
  fail_count: number;
  fail_until: number;
};

const NAV_KEY = "nav";
export const NAV_MEMORY_MS = 30_000;
export const NAV_REFRESH_AFTER_MS = 60_000;
export const NAV_BLOCKING_AFTER_MS = 24 * 60 * 60_000;
const LEASE_MS = 10_000;
const DEADLINE_MS = 3_500;
const MIN_CALL_MS = 200;
const COURIER_WINDOW_MS = 14 * 24 * 60 * 60_000;
const COURIER_LIMIT = 12;
const COURIER_TEXT_MAX = 160;
const FAIL_BACKOFF_MS = [60_000, 120_000, 300_000];
const NAV_CACHE_CONTROL = "public, max-age=30";

export const NAV_SNAPSHOT_SQL =
  "SELECT body, fetched_at, lease_until, fail_count, fail_until FROM api_cache WHERE key = ?1";
// Wins only when no one holds the lease and the failure backoff is over.
export const NAV_LEASE_SQL =
  "INSERT INTO api_cache (key, body, fetched_at, lease_until, fail_count, fail_until) VALUES (?1, '', 0, ?2, 0, 0) " +
  "ON CONFLICT(key) DO UPDATE SET lease_until = excluded.lease_until " +
  "WHERE api_cache.lease_until < ?3 AND api_cache.fail_until <= ?3";
export const NAV_SAVE_SQL =
  "UPDATE api_cache SET body = ?2, fetched_at = ?3, lease_until = 0, fail_count = 0, fail_until = 0 WHERE key = ?1";
export const NAV_FAIL_SQL = "UPDATE api_cache SET lease_until = 0, fail_count = ?2, fail_until = ?3 WHERE key = ?1";

let memory: { body: NavSnapshotBody; fetchedAt: number; loadedAt: number } | null = null;

export function resetNavForTest(): void {
  memory = null;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function truncate(text: string): string {
  const chars = [...text];
  return chars.length > COURIER_TEXT_MAX ? `${chars.slice(0, COURIER_TEXT_MAX - 1).join("")}…` : text;
}

function emptyLatest(): Record<NavTableSurfaceId, string | null> {
  return Object.fromEntries(NAV_TABLE_SURFACES.map((surface) => [surface.id, null])) as Record<NavTableSurfaceId, string | null>;
}

/** A cached body, or null when it is missing, malformed, or for another data env. */
export function parseNavBody(text: string | null | undefined, env: ApiDataEnv): NavSnapshotBody | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Partial<NavSnapshotBody>;
    if (parsed?.v !== 1 || parsed.env !== env || typeof parsed.fetchedAt !== "string") return null;
    if (!parsed.latest || typeof parsed.latest !== "object" || !parsed.weekly || !Array.isArray(parsed.courier)) return null;
    const latest = emptyLatest();
    for (const surface of NAV_TABLE_SURFACES) latest[surface.id] = isoOrNull(parsed.latest[surface.id]);
    return {
      v: 1,
      env,
      fetchedAt: parsed.fetchedAt,
      latest,
      weekly: { "colorful-philosophers": typeof parsed.weekly["colorful-philosophers"] === "string" ? parsed.weekly["colorful-philosophers"] : null },
      courier: parsed.courier.filter((item): item is NavCourierItem => (
        typeof item?.id === "string" && typeof item.storyId === "string" && typeof item.text === "string" && typeof item.createdAt === "string"
      )),
    };
  } catch {
    return null;
  }
}

type Row = Record<string, unknown>;

/**
 * Reads every surface from Supabase in waves of five under one deadline. A
 * failed surface keeps its previous value; `allFailed` means Supabase gave nothing.
 */
export async function fetchNavFromSupabase(
  config: SupabaseApiConfig,
  previous: NavSnapshotBody | null,
  now: number,
  fetcher?: Fetcher,
): Promise<{ body: NavSnapshotBody; allFailed: boolean }> {
  const deadline = Date.now() + DEADLINE_MS;
  const call = (path: string, params: Record<string, string>) => async (): Promise<RestResult<Row[]>> => {
    const remaining = Math.min(READ_TIMEOUT_MS, deadline - Date.now());
    if (remaining < MIN_CALL_MS) return { ok: false, status: 0, code: "timeout" };
    return postgrest<Row[]>(config, { path, query: new URLSearchParams(params), timeoutMs: remaining, fetcher });
  };
  const env = `eq.${config.dataEnv}`;
  const since = new Date(now - COURIER_WINDOW_MS).toISOString();

  // The courier scans comments without an (env, created_at) index, so it goes first.
  const tasks = [
    call("comments", { select: "id,story_id,content,created_at", env, created_at: `gte.${since}`, order: "created_at.desc", limit: String(COURIER_LIMIT) }),
    call(NAV_WEEKLY_SURFACE.table, { select: "week_start", env, week_start: `lte.${kstWeekStart(new Date(now))}`, order: "week_start.desc", limit: "1" }),
    // Postgres sorts NULL first in DESC; a NULL created_at row must not hide the latest one.
    ...NAV_TABLE_SURFACES.map((surface) => call(surface.table, {
      select: "created_at",
      env,
      created_at: "not.is.null",
      order: "created_at.desc.nullslast",
      limit: "1",
    })),
  ];
  const [courierResult, weeklyResult, ...tableResults] = await inWaves(tasks, 5);

  const courier = courierResult.ok && Array.isArray(courierResult.data)
    ? courierResult.data.flatMap((row) => {
        const id = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : "";
        const storyId = typeof row.story_id === "string" ? row.story_id : "";
        const text = truncate(courierCommentText(typeof row.content === "string" ? row.content : ""));
        const createdAt = isoOrNull(row.created_at);
        return id && storyId && text && createdAt ? [{ id, storyId, text, createdAt }] : [];
      })
    : previous?.courier ?? [];

  let weekly = previous?.weekly["colorful-philosophers"] ?? null;
  if (weeklyResult.ok && Array.isArray(weeklyResult.data)) {
    const value = weeklyResult.data[0]?.week_start;
    weekly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
  }

  const latest = emptyLatest();
  NAV_TABLE_SURFACES.forEach((surface, index) => {
    const result = tableResults[index];
    latest[surface.id] = result.ok && Array.isArray(result.data)
      ? isoOrNull(result.data[0]?.created_at)
      : previous?.latest[surface.id] ?? null;
  });

  return {
    body: {
      v: 1,
      env: config.dataEnv,
      fetchedAt: new Date(now).toISOString(),
      latest,
      weekly: { "colorful-philosophers": weekly },
      courier,
    },
    allFailed: [courierResult, weeklyResult, ...tableResults].every((result) => !result.ok),
  };
}

async function refreshUnderLease(
  db: D1Database,
  config: SupabaseApiConfig,
  previous: NavSnapshotBody | null,
  failCount: number,
  now: number,
): Promise<NavSnapshotBody | null> {
  const lease = await db.prepare(NAV_LEASE_SQL).bind(NAV_KEY, now + LEASE_MS, now).run();
  if ((lease.meta?.changes ?? 0) !== 1) return null;
  const { body, allFailed } = await fetchNavFromSupabase(config, previous, Date.now());
  if (allFailed) {
    const count = failCount + 1;
    const backoff = FAIL_BACKOFF_MS[Math.min(count, FAIL_BACKOFF_MS.length) - 1];
    await db.prepare(NAV_FAIL_SQL).bind(NAV_KEY, count, Date.now() + backoff).run();
    return null;
  }
  const fetchedAt = Date.parse(body.fetchedAt);
  await db.prepare(NAV_SAVE_SQL).bind(NAV_KEY, JSON.stringify(body), fetchedAt).run();
  memory = { body, fetchedAt, loadedAt: Date.now() };
  return body;
}

function respond(body: NavSnapshotBody): Response {
  return jsonResponse(body, { cacheControl: NAV_CACHE_CONTROL });
}

function unavailable(): Response {
  return apiError("unavailable");
}

async function readSnapshotRow(context: PublicRouteContext): Promise<{ row: SnapshotRow | null; failed: boolean }> {
  const prefetched = context.prefetched?.[0];
  if (prefetched) return { row: (prefetched[0] as SnapshotRow | undefined) ?? null, failed: false };
  if (!context.db) return { row: null, failed: true };
  const statement = context.db.prepare(NAV_SNAPSHOT_SQL).bind(NAV_KEY);
  const read = statement.first<SnapshotRow>();
  context.ctx.waitUntil(read.catch(() => undefined));
  try {
    return { row: await withTimeout(read, 1000), failed: false };
  } catch {
    return { row: null, failed: true };
  }
}

export async function handleNav(context: PublicRouteContext): Promise<Response> {
  const { config, now } = context;
  if (memory && memory.body.env === config.dataEnv && now - memory.loadedAt < NAV_MEMORY_MS) {
    return respond(memory.body);
  }

  const { row } = await readSnapshotRow(context);
  let body = row ? parseNavBody(row.body, config.dataEnv) : null;
  let fetchedAt = body && row ? row.fetched_at : 0;
  if (body) {
    memory = { body, fetchedAt, loadedAt: now };
  } else if (memory && memory.body.env === config.dataEnv) {
    // D1 had nothing usable; the isolate's last value still beats an error.
    body = memory.body;
    fetchedAt = memory.fetchedAt;
  }

  if (!context.allowUpstream || !context.db) return body ? respond(body) : unavailable();

  const age = body ? now - fetchedAt : Infinity;
  const backingOff = row ? now < row.fail_until : false;
  if (age < NAV_REFRESH_AFTER_MS || backingOff) return body ? respond(body) : unavailable();

  const refresh = refreshUnderLease(context.db, config, body, row?.fail_count ?? 0, now);
  context.ctx.waitUntil(refresh.catch(() => undefined));
  if (body && age < NAV_BLOCKING_AFTER_MS) return respond(body);

  // Nothing usable (first fill, or older than a day): this request waits for its own lease.
  const fresh = await refresh.catch(() => null);
  if (fresh) return respond(fresh);
  return body ? respond(body) : unavailable();
}

export const navRoutes: PublicRoute[] = [
  {
    id: "read.nav",
    method: "GET",
    path: "/api/read/nav",
    group: "nav",
    access: "public",
    prefetch: (db) => [db.prepare(NAV_SNAPSHOT_SQL).bind(NAV_KEY)],
    handle: handleNav,
  },
];

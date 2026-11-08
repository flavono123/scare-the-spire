import { D1_ADAPTERS } from "../d1-adapters";
import { Q_S5, Q_S6 } from "../d1-adapters/queries";
import { AdapterInputError, materialize, rawJsonLength } from "../d1-adapters/rows";
import type { D1Database } from "../d1";
import type { ExecutionContextLike } from "../flags";
import type { RouteResponseEvent } from "../router";
import { canonical, compareAnswers, differsOnRecentRows, type DiffEntry } from "./compare";
import { atRowCap, SHADOW_SPECS, type ShadowContext, type ShadowSpec, type SupabaseSide } from "./specs";

/**
 * Step 2 shadow reads (docs/supabase-exit/D1_SCHEMA_DESIGN.md 6). On a sampled api read the Worker
 * still answers from Supabase; in ctx.waitUntil it answers the same request from D1, compares the
 * two and counts the result in shadow_stats (S5), with one sample per distinct difference in
 * shadow_diffs (S6). Nothing here runs unless shadow.<group> is above 0 for the route's group.
 */

/** Answers bigger than this are not compared (CPU guard: Workers Free gives an invocation 10 ms). */
export const SHADOW_MAX_BYTES = 128 * 1024;
/** Rule 7: a difference on rows this recent is compared once more after this long. */
export const SYNC_LAG_MS = 2 * 60_000;
export const SAMPLE_MAX_BYTES = 8192;
const RECHECK_LIMIT = 16;
const RECHECK_TTL_MS = 5 * 60_000;
const RECHECKS_PER_REQUEST = 2;

export type ShadowOutcome =
  | { kind: "same" }
  | { kind: "expected" }
  | { kind: "differed"; entries: DiffEntry[] }
  | { kind: "deferred"; entries: DiffEntry[] }
  | { kind: "skipped"; reason: string };

let random: () => number = Math.random;

export function setShadowRandomForTest(source: (() => number) | null): void {
  random = source ?? Math.random;
}

type Recheck = { routeId: string; dueAt: number; expiresAt: number; run: (ctx: ExecutionContextLike, db: D1Database) => Promise<void> };
let rechecks: Recheck[] = [];

export function resetShadowForTest(): void {
  rechecks = [];
  random = Math.random;
}

export function pendingRechecksForTest(): readonly { routeId: string; dueAt: number }[] {
  return rechecks.map(({ routeId, dueAt }) => ({ routeId, dueAt }));
}

/** Reads a JSON answer up to `maxBytes`; a bigger answer is not compared. */
export async function readCappedJson(response: Response, maxBytes = SHADOW_MAX_BYTES): Promise<SupabaseSide> {
  if (response.status !== 200) {
    void response.body?.cancel().catch(() => undefined);
    return { ok: false, reason: "supabase_unavailable" };
  }
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    return { ok: false, reason: "too_large" };
  }
  if (!response.body) return { ok: false, reason: "supabase_unavailable" };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      void reader.cancel().catch(() => undefined);
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, answer: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: "supabase_unavailable" };
  }
}

function hasUnavailable(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as { unavailable?: unknown }).unavailable);
}

/** One comparison of a route's two answers under its shadow rules (rules 1-9 of design 6). */
export async function compareShadow(
  spec: ShadowSpec,
  context: ShadowContext,
  supabase: SupabaseSide,
  options: { recheck?: boolean; maxBytes?: number } = {},
): Promise<ShadowOutcome> {
  if (!supabase.ok) return { kind: "skipped", reason: supabase.reason };
  if (atRowCap(supabase.answer)) return { kind: "skipped", reason: "row_cap" };
  const skip = spec.skip?.(supabase.answer, context) ?? null;
  if (skip) return { kind: "skipped", reason: skip };
  const supabaseValue = spec.prepareSupabase ? spec.prepareSupabase(supabase.answer, context) : supabase.answer;

  const adapterContext = { db: context.db, dataEnv: context.config.dataEnv, url: context.url, userId: context.userId, now: context.now };
  let d1: unknown;
  try {
    const adapter = D1_ADAPTERS[context.routeId];
    if (!adapter && !spec.d1) return { kind: "skipped", reason: "no_adapter" };
    d1 = spec.d1 ? await spec.d1(adapterContext, supabase.answer) : await adapter(adapterContext);
  } catch (error) {
    return { kind: "skipped", reason: error instanceof AdapterInputError ? "d1_input" : "d1_unavailable" };
  }
  if (rawJsonLength(d1) > (options.maxBytes ?? SHADOW_MAX_BYTES)) return { kind: "skipped", reason: "too_large" };
  let d1Value = materialize(d1);
  if (spec.prepareD1) d1Value = spec.prepareD1(d1Value, supabaseValue, context);
  if (hasUnavailable(d1Value)) return { kind: "skipped", reason: "d1_unavailable" };

  const comparison = compareAnswers(supabaseValue, d1Value, spec.rules?.(context) ?? {});
  if (comparison.equal) return { kind: "same" };
  if (spec.expected && (await spec.expected(context, supabaseValue, d1Value))) return { kind: "expected" };
  if (!options.recheck && differsOnRecentRows(comparison.entries, context.now, SYNC_LAG_MS)) {
    return { kind: "deferred", entries: comparison.entries };
  }
  return { kind: "differed", entries: comparison.entries };
}

// --- Ledger (S5, S6) ---------------------------------------------------------------------------

export function shadowDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function shorten(value: unknown, textMax: number, depth = 0): unknown {
  if (typeof value === "string") return value.length > textMax ? `${value.slice(0, textMax)}…` : value;
  if (depth > 6) return "…";
  if (Array.isArray(value)) {
    const items = value.slice(0, 10).map((item) => shorten(item, textMax, depth + 1));
    return value.length > 10 ? [...items, `… ${value.length - 10} more`] : items;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = shorten(item, textMax, depth + 1);
    return out;
  }
  return value;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

/** The shadow_diffs sample: route, query and the first differences, cut to at most 8 KB. */
export function sampleText(context: Pick<ShadowContext, "routeId" | "url" | "now">, entries: readonly DiffEntry[]): string {
  const query = context.url.search.length > 1000 ? `${context.url.search.slice(0, 1000)}…` : context.url.search;
  const base = { route: context.routeId, query, at: new Date(context.now).toISOString() };
  for (const textMax of [400, 120, 40]) {
    for (let count = entries.length; count >= 1; count = Math.floor(count / 2)) {
      const text = JSON.stringify({ ...base, entries: shorten(entries.slice(0, count), textMax), shown: count, total: entries.length });
      if (utf8Length(text) <= SAMPLE_MAX_BYTES) return text;
    }
  }
  return JSON.stringify({ ...base, query: query.slice(0, 200), entries: [], shown: 0, total: entries.length });
}

/** Hash of the normalized difference, so repeats of one difference collapse into one sample row. */
export async function diffHash(routeId: string, entries: readonly DiffEntry[]): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${routeId}\n${canonical(entries)}`));
  return [...new Uint8Array(digest)].slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Writes one outcome: S5 always, S6 for a difference. Deferred outcomes are not written. */
export async function recordOutcome(db: D1Database, context: Pick<ShadowContext, "routeId" | "url" | "now">, outcome: ShadowOutcome): Promise<void> {
  if (outcome.kind === "deferred") return;
  const day = shadowDay(context.now);
  const compared = outcome.kind === "skipped" ? 0 : 1;
  const differed = outcome.kind === "differed" ? 1 : 0;
  const skipped = outcome.kind === "skipped" ? 1 : 0;
  const statements = [db.prepare(Q_S5).bind(day, context.routeId, compared, differed, skipped)];
  if (outcome.kind === "differed") {
    const hash = await diffHash(context.routeId, outcome.entries);
    statements.push(db.prepare(Q_S6).bind(day, context.routeId, hash, context.now, sampleText(context, outcome.entries)));
  }
  await db.batch(statements);
}

function log(routeId: string, outcome: ShadowOutcome): void {
  // Route ids and reasons only: never rows, keys, ids or query strings (STEP1_DESIGN 4.5).
  if (outcome.kind === "same" || outcome.kind === "expected") return;
  console.log(`shadow ${routeId} ${outcome.kind}${outcome.kind === "skipped" ? `:${outcome.reason}` : ""}`);
}

// --- The router hook -------------------------------------------------------------------------------

function enqueueRecheck(entry: Recheck): boolean {
  const now = Date.now();
  rechecks = rechecks.filter((item) => item.expiresAt > now);
  if (rechecks.length >= RECHECK_LIMIT) return false;
  rechecks.push(entry);
  return true;
}

/** Runs due rechecks (rule 7) in this request's waitUntil, a few at a time. */
function drainRechecks(ctx: ExecutionContextLike, db: D1Database): void {
  if (rechecks.length === 0) return;
  const now = Date.now();
  rechecks = rechecks.filter((item) => item.expiresAt > now);
  const due = rechecks.filter((item) => item.dueAt <= now).slice(0, RECHECKS_PER_REQUEST);
  if (due.length === 0) return;
  rechecks = rechecks.filter((item) => !due.includes(item));
  for (const item of due) ctx.waitUntil(item.run(ctx, db).catch(() => undefined));
}

type ShadowRun = {
  spec: ShadowSpec;
  context: ShadowContext;
  supabase: () => Promise<SupabaseSide>;
  /** A fresh Supabase answer for the recheck, read in a later request. */
  again: (ctx: ExecutionContextLike) => Promise<SupabaseSide>;
};

async function runShadow(run: ShadowRun, recheck: boolean): Promise<void> {
  const outcome = await compareShadow(run.spec, run.context, await run.supabase(), { recheck });
  log(run.context.routeId, outcome);
  if (outcome.kind === "deferred") {
    const queued = enqueueRecheck({
      routeId: run.context.routeId,
      dueAt: Date.now() + SYNC_LAG_MS,
      expiresAt: Date.now() + SYNC_LAG_MS + RECHECK_TTL_MS,
      run: (ctx, db) => {
        const context = { ...run.context, db, now: Date.now() };
        return runShadow({ ...run, context, supabase: () => run.again(ctx) }, true);
      },
    });
    // No room to recheck: the pair is counted as not compared.
    if (!queued) await recordOutcome(run.context.db, run.context, { kind: "skipped", reason: "lag_queue_full" });
    return;
  }
  await recordOutcome(run.context.db, run.context, outcome);
}

/**
 * The api router's response hook: on a sampled 200 GET of a route with shadow rules, answer as
 * before and compare in ctx.waitUntil. The client's response is the original; a copy (tee) of its
 * body is read here up to SHADOW_MAX_BYTES, unless the spec reads Supabase itself.
 */
export function shadowOnResponse(event: RouteResponseEvent): Response {
  const { route, context, response } = event;
  const db = context.db;
  if (!db) return response;
  drainRechecks(context.ctx, db);
  if (route.method !== "GET" || response.status !== 200) return response;
  const spec = SHADOW_SPECS[route.id];
  if (!spec) return response;
  const rate = event.shadow?.get(route.group) ?? 0;
  if (!(rate > 0) || random() >= rate) return response;

  const user = "user" in context ? (context.user as { userId?: string } | undefined) : undefined;
  const shadowContext: ShadowContext = {
    routeId: route.id,
    url: context.url,
    config: context.config,
    db,
    userId: user?.userId ?? null,
    now: context.now,
  };
  const own = spec.supabase?.(shadowContext) ?? null;
  let supabase: () => Promise<SupabaseSide>;
  if (own) {
    supabase = () => own;
  } else {
    const copy = response.clone();
    supabase = () => readCappedJson(copy);
  }
  const again = async (ctx: ExecutionContextLike): Promise<SupabaseSide> => {
    const fresh = { ...shadowContext, now: Date.now() };
    const read = spec.supabase?.(fresh) ?? null;
    if (read) return read;
    return readCappedJson(await event.rerun(ctx));
  };
  context.ctx.waitUntil(runShadow({ spec, context: shadowContext, supabase, again }, false).catch(() => undefined));
  return response;
}

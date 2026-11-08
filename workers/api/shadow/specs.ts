import { parseEngagementList } from "../../../src/lib/engagement-keys";
import { RUN_DETAIL_COLUMNS, RUN_SUMMARY_COLUMNS } from "../../../src/lib/history-runs-api-rules";
import { TOYBOX_POST_TABLES } from "../../../src/lib/toybox-api-rules";
import { navAdapter } from "../d1-adapters/nav";
import { columnsOf, pick, type AdapterContext } from "../d1-adapters/rows";
import { DEAD_POST_COLUMNS, type FeedService } from "../d1-adapters/toybox";
import type { D1Database } from "../d1";
import { HANDLER_BUDGET_MS } from "../routes/comments";
import { postgrest, type Fetcher, type SupabaseApiConfig } from "../supabase-rest";
import { dropKeys, type CompareRules, type ListRule } from "./compare";

/**
 * Per-route shadow rules (docs/supabase-exit/D1_SCHEMA_DESIGN.md 6): where the Supabase answer comes
 * from, how each side is prepared, how lists compare (rule 1), what cannot be compared (rules 6 and
 * the nav snapshot age) and which differences are expected (rule 5). Rules 2 (JSON values), 3 (dead
 * columns), 4 (copied counters: nothing to do), 7 (sync lag, shadow.ts), 8 (run covers: columns
 * without the raw) and 9 (crafted values: always counted) are applied here or in shadow.ts.
 */

export type ShadowContext = {
  routeId: string;
  url: URL;
  config: SupabaseApiConfig;
  db: D1Database;
  userId: string | null;
  now: number;
  fetcher?: Fetcher;
};

export type SupabaseSide = { ok: true; answer: unknown } | { ok: false; reason: string };

export type ShadowSpec = {
  /**
   * Reads the Supabase side itself when the route's own answer cannot be used (it carries raw run
   * files too big to read); null: compare the route's answer.
   */
  supabase?: (context: ShadowContext) => Promise<SupabaseSide> | null;
  /** Answers the D1 side; default: the route's D1 adapter. */
  d1?: (context: AdapterContext, supabase: unknown) => Promise<unknown>;
  /** The Supabase answer before comparing (dead columns removed, rule 3). */
  prepareSupabase?: (answer: unknown, context: ShadowContext) => unknown;
  /**
   * The D1 answer before comparing, projected onto what the Supabase answer carries. It gets the
   * adapter's answer with JSON columns still unparsed (RawJson), so dropped columns are never parsed.
   */
  prepareD1?: (answer: unknown, supabase: unknown, context: ShadowContext) => unknown;
  rules?: (context: ShadowContext) => CompareRules;
  /** Why this pair cannot be compared, or null. */
  skip?: (supabase: unknown, context: ShadowContext) => string | null;
  /** True when the difference is an expected one (rule 5). */
  expected?: (context: ShadowContext, supabase: unknown, d1: unknown) => Promise<boolean>;
};

/** PostgREST's row cap (Supabase max rows): an answer with this many rows may be cut (rule 6). */
export const POSTGREST_ROW_CAP = 1000;
/** The nav snapshot is refreshed after 60 s; an older snapshot describes another time. */
export const NAV_SNAPSHOT_MAX_AGE_MS = 90_000;
const SUPABASE_READ_MAX_BYTES = 128 * 1024;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sum(value: unknown): number {
  return Object.values(record(value)).reduce((total: number, item) => total + (typeof item === "number" ? item : 0), 0);
}

function unavailableSkip(answer: unknown): string | null {
  return Array.isArray(record(answer).unavailable) ? "unavailable" : null;
}

const PHILOSOPHER_DEAD = ["buff_count", "nerf_count", "rework_count"];

const set = (path: string): ListRule => ({ path, set: true });
const rules = (lists: ListRule[], ignore?: string[]) => (): CompareRules => ({ lists, ignore });

function scoreKeys(sort: string | null): string[] {
  if (sort === "recommended") return ["like_count", "created_at"];
  if (sort === "comments") return ["comment_count", "created_at"];
  return ["created_at"];
}

/** A raw-less read of `runs` (design 6: the same columns on both sides, the raw checked daily by hash). */
async function runsWithoutRaw(context: ShadowContext, select: string, params: Record<string, string>): Promise<SupabaseSide> {
  const result = await postgrest<unknown[]>(context.config, {
    path: "runs",
    deadline: Date.now() + HANDLER_BUDGET_MS,
    maxBytes: SUPABASE_READ_MAX_BYTES,
    fetcher: context.fetcher,
    query: new URLSearchParams({ select, env: `eq.${context.config.dataEnv}`, ...params }),
  });
  if (!result.ok) return { ok: false, reason: result.code === "too_large" ? "too_large" : "supabase_unavailable" };
  return { ok: true, answer: result.data ?? [] };
}

const RUN_LIST_COLUMNS = columnsOf(RUN_SUMMARY_COLUMNS).filter((name) => name !== "raw");
const RUN_DETAIL_META_COLUMNS = columnsOf(RUN_DETAIL_COLUMNS).filter((name) => name !== "raw");

function projectRows(answer: unknown, columns: readonly string[]): unknown {
  return Array.isArray(answer) ? answer.map((row) => pick(record(row), columns)) : answer;
}

function feedService(context: ShadowContext): FeedService {
  return (context.url.searchParams.get("service") ?? "") as FeedService;
}

/** Rule 5: a 조각모음 body whose post is gone from Supabase is an expected difference. */
async function orphanBody(context: ShadowContext, supabase: unknown, d1: unknown): Promise<boolean> {
  if (!Array.isArray(supabase) || supabase.length !== 1 || !Array.isArray(d1) || d1.length !== 0) return false;
  const service = context.url.searchParams.get("service") ?? "";
  const id = (context.url.searchParams.get("id") ?? "").toLowerCase();
  const table = service === "history_course" ? "runs" : (TOYBOX_POST_TABLES as Record<string, string>)[service];
  // A body under a service no post table has can never have its post.
  if (!table) return true;
  const result = await postgrest<unknown[]>(context.config, {
    path: table,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    fetcher: context.fetcher,
    query: new URLSearchParams({ select: "id", id: `eq.${id}`, env: `eq.${context.config.dataEnv}`, limit: "1" }),
  });
  return result.ok && Array.isArray(result.data) && result.data.length === 0;
}

export const SHADOW_SPECS: Readonly<Record<string, ShadowSpec>> = {
  "read.nav": {
    // The snapshot describes Supabase at fetchedAt: D1 is read as of that time.
    d1: (context, supabase) => navAdapter(context, Date.parse(String(record(supabase).fetchedAt))),
    skip: (supabase, context) => {
      const fetchedAt = Date.parse(String(record(supabase).fetchedAt));
      if (Number.isNaN(fetchedAt)) return "unavailable";
      return context.now - fetchedAt > NAV_SNAPSHOT_MAX_AGE_MS ? "stale_snapshot" : null;
    },
    rules: rules([{ path: "courier", keys: ["createdAt"], limit: 12 }], ["fetchedAt"]),
  },
  "read.engagement": {
    skip: unavailableSkip,
    prepareSupabase: (answer) => dropKeys(answer, "philosophers.*.[]", PHILOSOPHER_DEAD),
    // Reply threads the Supabase path left out for time (comments.ts SECOND_WAVE_MIN_MS) are not compared.
    prepareD1: (answer, supabase, context) => {
      const threads = record(answer).threads;
      if (!threads) return answer;
      const asked = new Set(parseEngagementList("threads", context.url.searchParams.get("threads") ?? "") ?? []);
      const supabaseThreads = record(record(supabase).threads);
      const kept = Object.fromEntries(Object.entries(record(threads)).filter(([key]) => asked.has(key) || key in supabaseThreads));
      const out = { ...record(answer) };
      if (Object.keys(kept).length || "threads" in record(supabase)) out.threads = kept;
      else delete out.threads;
      return out;
    },
    rules: rules([{ path: "threads.*", keys: ["created_at"] }, { path: "philosophers.*", keys: ["week_start"], limit: 20 }]),
  },
  "read.engagement-counts": {},
  "me.engagement": { skip: unavailableSkip, rules: rules([set("commentLikes.*")]) },
  "read.colorful-philosophers.week": {
    skip: (supabase) => {
      const counts = record(supabase).commentCounts;
      if (!counts) return "unavailable";
      return sum(counts) >= POSTGREST_ROW_CAP ? "row_cap" : null;
    },
    prepareSupabase: (answer) => dropKeys(answer, "posts.[]", PHILOSOPHER_DEAD),
    rules: rules([{ path: "posts", keys: ["week_start"], limit: 100 }]),
  },
  "read.colorful-philosophers.post": { prepareSupabase: (answer) => dropKeys(answer, "post", PHILOSOPHER_DEAD) },
  "read.colorful-philosophers.reel": { rules: rules([{ path: "posts", keys: ["week_start"], limit: 12 }]) },
  "me.mailbox": {},
  "read.profile.nicknames": { rules: rules([set("rows")]) },
  "me.profile.stats": { rules: rules([set("rows")]) },
  "me.profile.activity": {
    rules: (context) => ({
      lists: [{
        path: "rows",
        keys: context.url.searchParams.get("sort") === "likes" ? ["like_count", "created_at"] : ["created_at"],
        limit: 20,
      }],
    }),
  },
  "me.profile.inquiries": { rules: rules([{ path: "rows", keys: ["created_at"], limit: 50 }]) },
  "read.puzzlebox.leaderboard": {},
  "me.puzzlebox.leaderboard": {},
  "me.puzzlebox.standings": { rules: rules([set("standings")]) },
  "read.history-runs": {
    supabase: (context) => context.url.searchParams.get("view") === "recent"
      ? runsWithoutRaw(context, RUN_LIST_COLUMNS.join(","), { order: "created_at.desc", limit: "100" })
      : runsWithoutRaw(context, RUN_LIST_COLUMNS.join(","), { order: "start_time.desc", limit: "30" }),
    prepareD1: (answer) => projectRows(answer, RUN_LIST_COLUMNS),
    rules: (context) => ({
      lists: [context.url.searchParams.get("view") === "recent"
        ? { path: "", keys: ["created_at"], limit: 100 }
        : { path: "", keys: ["start_time"], limit: 30 }],
    }),
  },
  "read.history-run": {
    supabase: (context) => {
      const id = context.url.searchParams.get("id") ?? "";
      const view = context.url.searchParams.get("view") ?? "detail";
      if (view === "meta") return null;
      const select = view === "cover" ? "id,cover_spec" : RUN_DETAIL_META_COLUMNS.join(",");
      return runsWithoutRaw(context, select, { id: `eq.${id}`, limit: "1" });
    },
    prepareD1: (answer, _supabase, context) => {
      const view = context.url.searchParams.get("view") ?? "detail";
      if (view === "meta") return answer;
      return projectRows(answer, view === "cover" ? ["id", "cover_spec"] : RUN_DETAIL_META_COLUMNS);
    },
  },
  "read.history-runs.engagement": {
    skip: (supabase) => (sum(record(supabase).likes) >= POSTGREST_ROW_CAP || sum(record(supabase).comments) >= POSTGREST_ROW_CAP ? "row_cap" : null),
  },
  "me.history-runs": { rules: rules([set("ids")]) },
  "read.stories": {
    rules: (context) => ({ lists: [{ path: "", keys: ["created_at"], limit: Number(context.url.searchParams.get("limit") ?? "100") }] }),
  },
  "read.toybox-feed": {
    prepareSupabase: (answer, context) => dropKeys(answer, "[].post", DEAD_POST_COLUMNS[feedService(context)] ?? []),
  },
  "read.defragment-feed": {
    rules: (context) => ({ lists: [{ path: "", keys: scoreKeys(context.url.searchParams.get("sort")), limit: 20 }] }),
  },
  "read.defragment-runs": {
    rules: (context) => ({ lists: [{ path: "", keys: scoreKeys(context.url.searchParams.get("sort")), limit: 20 }] }),
  },
  "read.toybox-post": {
    prepareSupabase: (answer, context) => dropKeys(answer, "[]", DEAD_POST_COLUMNS[feedService(context)] ?? []),
  },
  "read.favorite-tournament.presets": {
    prepareSupabase: (answer) => dropKeys(answer, "[]", DEAD_POST_COLUMNS.favorite_tournament ?? []),
    rules: rules([{ path: "", keys: ["created_at"] }]),
  },
  "read.favorite-tournament.stats": { rules: rules([set("")]) },
  "read.pagestorm.posts": { rules: rules([{ path: "", keys: ["created_at"], limit: 50 }]) },
  "me.pagestorm.drafts": {},
  "read.defragment-body": { expected: orphanBody },
  "read.this-or-that.like-counts": { rules: rules([set("rows")]) },
  "me.this-or-that.likes": { rules: rules([set("rows")]) },
  "read.this-or-that.vote-summaries": { rules: rules([set("rows")]) },
  "me.this-or-that.votes": { rules: rules([set("rows")]) },
};

/** Rule 6: any list of the Supabase answer at PostgREST's row cap may have been cut. */
export function atRowCap(answer: unknown): boolean {
  if (Array.isArray(answer)) return answer.length >= POSTGREST_ROW_CAP;
  return Object.values(record(answer)).some((value) => Array.isArray(value) && value.length >= POSTGREST_ROW_CAP);
}

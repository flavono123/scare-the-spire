/**
 * The full D1 -> Supabase reload (docs/SUPABASE_EXIT_PLAN.md 7.3 step 7, 7.4): the manual way back to
 * Supabase once the step 5 mirror has been turned off. The CLI is scripts/d1-reload-supabase.ts.
 *
 * It makes Supabase's rows of one env equal D1's, table by table, with the mirror's own encoding
 * (workers/api/d1-write/tables.ts): source columns only, so Supabase's triggers recount the derived
 * values (post counts, comments.like_count, reaction totals) from the rows it gains or loses; runs
 * through the mirror_run text RPC (the raw unescaped), tournament plays through
 * mirror_favorite_tournament_play (play_count recounted, the stats D1 computed upserted as state).
 *
 *   1. Upserts, parents first, in chunks (merge-duplicates on the mirror's conflict key).
 *   2. Deletes, leaf first: Supabase rows of this env whose key D1 does not have.
 * Env-less puzzlebox_players only from production (design 5.5). Writes must be paused and every write
 * source must be d1 (D1 holds the truth and nothing moves while the copy runs). Running it again
 * changes nothing. It never writes D1.
 */
import { WRITE_GROUPS, WRITE_PAUSED_KEY, sourceFlagKey } from "../../src/lib/write-source-flags";
import { call, callForRow, send, type MirrorConfig } from "../../workers/api/d1-write/mirror";
import { MIRROR_TABLES, rowJson, type MirrorTable } from "../../workers/api/d1-write/tables";
import type { Fetcher } from "../../workers/api/supabase-rest";
import { DATA_ENVS, readFlags, SYNC_FLAG_KEY, type CutoverTarget } from "./cutover";
import type { D1HttpClient } from "./d1-http-client";
import type { PostgrestReader } from "./postgrest-reader";

/** Upsert order: every parent before its children (FKs in Supabase). */
export const RELOAD_ORDER: readonly string[] = [
  "puzzlebox_players",
  "comments",
  "community_stories",
  "chemical_posts",
  "combo_posts",
  "transfigure_posts",
  "this_or_that_posts",
  "favorite_tournament_posts",
  "decisions_decisions_posts",
  "pagestorm_posts",
  "runs",
  "pagestorm_drafts",
  "defragment_bodies",
  "this_or_that_post_votes",
  "this_or_that_post_likes",
  "favorite_tournament_plays",
  "comment_likes",
  "likes",
  "resource_reactions",
  "contact_inquiries",
  "puzzlebox_runs",
  "puzzlebox_best",
  "puzzlebox_board_stats",
];

/** Written by the tournament RPC with each play; never upserted or deleted on its own. */
const VIA_PLAY_RPC = new Set(["favorite_tournament_candidate_stats"]);

/**
 * Write-only columns D1 does not keep that are NOT NULL in Supabase (design 7: the mirror sends the
 * request's value). A row Supabase already has keeps its value; a row created after the mirror
 * stopped gets this placeholder, which passes the column's CHECK and which nothing reads.
 */
export const WRITE_ONLY_DEFAULTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  this_or_that_post_votes: { created_surface: "detail" },
  transfigure_posts: { source_game_locale: "kor" },
  favorite_tournament_posts: { game_version: "d1-reload" },
};

export const CHUNK_ROWS = 200;
export const CHUNK_BYTES = 512 * 1024;
export const D1_PAGE = 500;
export const RUN_KEY_PAGE = 200;

export interface ReloadPorts {
  d1: D1HttpClient;
  supabase: PostgrestReader;
  config: MirrorConfig;
  fetcher: Fetcher;
  log(line: string): void;
}

export interface ReloadOptions {
  target: CutoverTarget;
  dryRun?: boolean;
  /** Only these Supabase tables (default: all). */
  tables?: readonly string[];
}

export interface TableResult {
  table: string;
  d1Rows: number;
  upserted: number;
  extra: number;
  deleted: number;
}

export interface ReloadReport {
  status: "done" | "dry_run" | "refused" | "failed";
  lines: string[];
  tables: TableResult[];
}

/** readSql (one row by key) -> every row: each `<column> = ?n` of the key becomes true. */
export function allRowsSql(spec: MirrorTable): string {
  const sql = spec.readSql.replace(/[\w.]+ = \?\d+/g, "1 = 1");
  if (/\?\d/.test(sql)) throw new Error(`${spec.table}: read SQL keeps a parameter`);
  return sql;
}

function keyOf(spec: MirrorTable, row: Record<string, unknown>): string {
  return JSON.stringify(spec.key.map((name) => String(row[name])));
}

function quoted(name: string): string {
  return `"${name.replace(/"/g, "")}"`;
}

/** Every D1 row of a table as the mirror reads it, page by page in key order. */
async function* d1Rows(d1: D1HttpClient, spec: MirrorTable): AsyncGenerator<Record<string, unknown>[]> {
  if (spec.table === "runs") {
    // A run row carries its raw (up to 1.9 MB): the keys first, then each run by the mirror's S14 read.
    for (let after = ""; ; ) {
      const keys = await d1.query(
        `SELECT id FROM posts WHERE service = 'history_course' AND id > ?1 ORDER BY id LIMIT ${RUN_KEY_PAGE}`,
        [after],
      );
      if (keys.rows.length === 0) return;
      const page: Record<string, unknown>[] = [];
      for (const key of keys.rows) {
        const row = (await d1.query(spec.readSql, [String(key.id)])).rows[0];
        if (row) page.push(row);
      }
      yield page;
      after = String(keys.rows[keys.rows.length - 1].id);
    }
  }
  const order = spec.key.map(quoted).join(", ");
  const base = `SELECT * FROM (${allRowsSql(spec)}) ORDER BY ${order}`;
  for (let offset = 0; ; offset += D1_PAGE) {
    const result = await d1.query(`${base} LIMIT ${D1_PAGE} OFFSET ${offset}`);
    if (result.rows.length === 0) return;
    yield result.rows;
    if (result.rows.length < D1_PAGE) return;
  }
}

async function statsOf(d1: D1HttpClient, tournamentId: string): Promise<Record<string, unknown>[]> {
  const spec = MIRROR_TABLES.favorite_tournament_candidate_stats;
  return (await d1.query(spec.readSql, [tournamentId])).rows;
}

/**
 * Supabase keys of this env, with the table's write-only columns (comment_likes: every row; the
 * caller keeps the ones under this env's comments).
 */
async function supabaseKeys(supabase: PostgrestReader, spec: MirrorTable, env: string): Promise<Record<string, unknown>[]> {
  return supabase.selectAll(spec.table, {
    select: [...spec.key, ...Object.keys(WRITE_ONLY_DEFAULTS[spec.table] ?? {})].join(","),
    filters: spec.hasEnv ? [{ column: "env", op: "eq", value: env }] : [],
    order: spec.key.join(","),
    pageSize: 1000,
  });
}

class Failed extends Error {}

export async function runReload(ports: ReloadPorts, options: ReloadOptions): Promise<ReloadReport> {
  const lines: string[] = [];
  const say = (line: string) => {
    lines.push(line);
    ports.log(line);
  };
  const env = DATA_ENVS[options.target];
  const results: TableResult[] = [];
  say(`D1 -> Supabase reload, target ${options.target} (Supabase env ${env})${options.dryRun ? ", dry run" : ""}`);
  if (ports.config.dataEnv !== env) throw new Error("the Supabase config env does not match the target");

  const flags = await readFlags(ports.d1);
  const notD1 = WRITE_GROUPS.filter((group) => flags.get(sourceFlagKey(group)) !== "d1");
  if (notD1.length) {
    say(`refused: source.${notD1[0]} is not d1 (Supabase may hold the newest writes; this would overwrite them)`);
    return { status: "refused", lines, tables: results };
  }
  if (flags.get(SYNC_FLAG_KEY) === "on") {
    say("refused: sync.enabled is on (it would copy the reload back into D1)");
    return { status: "refused", lines, tables: results };
  }
  if (!options.dryRun && flags.get(WRITE_PAUSED_KEY) !== "on") {
    say("refused: set write.paused on first (writes during the copy would be missed)");
    return { status: "refused", lines, tables: results };
  }

  const wanted = (table: string) => !options.tables || options.tables.includes(table);
  const tables = RELOAD_ORDER.filter((table) => wanted(table))
    .filter((table) => !(MIRROR_TABLES[table].productionOnly && options.target !== "production"));
  for (const table of RELOAD_ORDER) {
    if (!MIRROR_TABLES[table]) throw new Error(`no mirror spec for ${table}`);
  }
  for (const table of Object.keys(MIRROR_TABLES)) {
    if (!RELOAD_ORDER.includes(table) && !VIA_PLAY_RPC.has(table)) throw new Error(`reload order misses ${table}`);
  }

  const d1KeySets = new Map<string, Set<string>>();
  try {
    // 0. What Supabase has of this env now (keys and write-only columns).
    const existing = new Map<string, Map<string, Record<string, unknown>>>();
    const commentIds = new Set((await supabaseKeys(ports.supabase, MIRROR_TABLES.comments, env)).map((row) => String(row.id)));
    for (const table of tables) {
      const spec = MIRROR_TABLES[table];
      let rows = await supabaseKeys(ports.supabase, spec, env);
      if (table === "comment_likes") rows = rows.filter((row) => commentIds.has(String(row.comment_id)));
      existing.set(table, new Map(rows.map((row) => [keyOf(spec, row), row])));
    }

    // 1. Upserts, parents first.
    for (const table of tables) {
      const spec = MIRROR_TABLES[table];
      const result: TableResult = { table, d1Rows: 0, upserted: 0, extra: 0, deleted: 0 };
      results.push(result);
      const keys = new Set<string>();
      d1KeySets.set(table, keys);
      const writeOnly = WRITE_ONLY_DEFAULTS[table];
      const before = existing.get(table)!;
      for await (const page of d1Rows(ports.d1, spec)) {
        for (const row of page) keys.add(keyOf(spec, row));
        result.d1Rows += page.length;
        if (options.dryRun) continue;
        if (table === "runs" || table === "favorite_tournament_plays") {
          // One call per row: the run text RPC, the play RPC with its tournament's stats.
          for (const row of page) {
            const stats = table === "favorite_tournament_plays" ? await statsOf(ports.d1, String(row.tournament_id)) : undefined;
            const built = callForRow(ports.config, table, table === "runs" ? "upsert" : "rpc", row, stats);
            const sent = await send(ports.config, ports.fetcher, built);
            if (!sent.ok) throw new Failed(`${table}: Supabase refused a row (${sent.code})`);
            result.upserted += 1;
          }
          continue;
        }
        // Bulk upserts: the mirror's body for each row, merged on its conflict key.
        let chunk: string[] = [];
        let bytes = 0;
        const flush = async () => {
          if (!chunk.length) return;
          const sent = await call(ports.config, ports.fetcher, {
            method: "POST",
            path: spec.table,
            query: new URLSearchParams({ on_conflict: spec.conflict.join(",") }),
            body: `[${chunk.join(",")}]`,
            prefer: ["resolution=merge-duplicates"],
          });
          if (!sent.ok) throw new Failed(`${table}: Supabase refused a chunk of ${chunk.length} rows (${sent.code})`);
          result.upserted += chunk.length;
          chunk = [];
          bytes = 0;
        };
        for (const row of page) {
          const kept = writeOnly ? before.get(keyOf(spec, row)) : undefined;
          const extra = writeOnly ? Object.fromEntries(Object.entries(writeOnly).map(([name, value]) => [name, kept?.[name] ?? value])) : null;
          const text = rowJson(spec, row, { env, extra });
          if (chunk.length >= CHUNK_ROWS || (chunk.length && bytes + text.length > CHUNK_BYTES)) await flush();
          chunk.push(text);
          bytes += text.length;
        }
        await flush();
      }
    }

    // 2. Deletes, leaf first: what Supabase had of this env and D1 does not (a row a parent's
    //    cascade already took answers 204 too).
    for (const table of [...tables].reverse()) {
      const spec = MIRROR_TABLES[table];
      const result = results.find((entry) => entry.table === table)!;
      const d1Keys = d1KeySets.get(table)!;
      const extra = [...existing.get(table)!.entries()].filter(([key]) => !d1Keys.has(key)).map(([, row]) => row);
      result.extra = extra.length;
      if (options.dryRun) continue;
      for (const row of extra) {
        const query = new URLSearchParams();
        for (const name of spec.key) query.set(name, `eq.${String(row[name])}`);
        if (spec.hasEnv) query.set("env", `eq.${env}`);
        const sent = await call(ports.config, ports.fetcher, { method: "DELETE", path: spec.table, query });
        if (!sent.ok) throw new Failed(`${table}: Supabase refused a delete (${sent.code})`);
        result.deleted += 1;
      }
    }
  } catch (error) {
    for (const result of results) say(tableLine(result));
    say(`stopped: ${(error as Error).message}. Running the reload again picks up from the same state (it is idempotent).`);
    return { status: "failed", lines, tables: results };
  }
  for (const result of results) say(tableLine(result));
  say(options.dryRun
    ? "dry run: nothing written"
    : "done. Next: check with the reconcile, then set every source.<group> to supabase and write.paused off (scripts/runtime-flags.ts).");
  return { status: options.dryRun ? "dry_run" : "done", lines, tables: results };
}

function tableLine(result: TableResult): string {
  return `${result.table}: D1 ${result.d1Rows} rows, upserted ${result.upserted}, Supabase-only ${result.extra}, deleted ${result.deleted}`;
}

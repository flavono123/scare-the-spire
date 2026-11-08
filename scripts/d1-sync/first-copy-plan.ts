/**
 * The first copy's plan (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.2): a `pg_dump --data-only` text of
 * the 27 copied tables -> the D1 statements of one env, in parent-first order, with every check 5.2
 * lists counted on the way. Pure: no D1, no network. scripts/d1-first-copy.ts runs it.
 */
import { canonicalTs } from "../../src/lib/d1-time";
import { parseCopyLine } from "../../src/lib/d1-sync/pg-text";
import {
  copiedColumns,
  imageFromPgText,
  mapRow,
  POST_TABLE_SERVICES,
  RUN_RAW_MAX_BYTES,
  runSummaryFillStatement,
  SUPABASE_TABLES,
  type RowImage,
} from "../../src/lib/d1-sync/row-mapper";
import type { D1Statement } from "../../src/lib/d1-sync/statements";
import { extractRunListSummary } from "../../src/lib/run-list-summary";

export type DataEnv = "development" | "production";
export type PgRow = Record<string, string | null>;

export interface CopyBlock {
  columns: string[];
  rows: PgRow[];
}

/** The COPY blocks of a pg_dump plain-text (or pg_restore -f) output, by table name. */
export function parseDumpCopyBlocks(text: string): Map<string, CopyBlock> {
  const blocks = new Map<string, CopyBlock>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^COPY public\.("?)(\w+)\1 \((.*)\) FROM stdin;$/.exec(lines[i]);
    if (!match) continue;
    const columns = match[3].split(",").map((name) => name.trim().replace(/^"|"$/g, ""));
    const rows: PgRow[] = [];
    for (i += 1; i < lines.length && lines[i] !== "\\."; i++) {
      const fields = parseCopyLine(lines[i]);
      if (fields.length !== columns.length) {
        throw new Error(`COPY public.${match[2]}: a line has ${fields.length} fields for ${columns.length} columns`);
      }
      rows.push(Object.fromEntries(columns.map((name, j) => [name, fields[j]])));
    }
    if (i >= lines.length) throw new Error(`COPY public.${match[2]} has no end marker`);
    blocks.set(match[2], { columns, rows });
  }
  return blocks;
}

// ------------------------------------------------------------------------------------------- order

/** The group of the run summary fill statements (RF2) in the order below. */
export const SUMMARY_FILL = "post_history_course (RF2)";

/**
 * Parent-first order of the D1 tables (design 5.2 step 5): posts -> post_* -> children -> satellites,
 * comments -> comment_likes, puzzlebox_players -> puzzlebox_runs -> puzzlebox_best. The run summary
 * fill (RF2) follows the run rows it updates.
 */
export const D1_TABLE_ORDER = [
  "posts",
  "post_chemical_x",
  "post_combo",
  "post_transfigure",
  "post_this_or_that",
  "post_favorite_tournament",
  "post_decisions_decisions",
  "post_pagestorm",
  "post_history_course",
  "post_combo_resources",
  "post_favorite_tournament_pool",
  "this_or_that_post_votes",
  "this_or_that_post_likes",
  "favorite_tournament_candidate_stats",
  "favorite_tournament_plays",
  "defragment_bodies",
  "post_history_course_file",
  SUMMARY_FILL,
  "pagestorm_drafts",
  "comments",
  "comment_likes",
  "likes",
  "resource_reactions",
  "resource_reaction_counts",
  "community_stories",
  "profile_character_nickname_pools",
  "contact_inquiries",
  "puzzlebox_players",
  "puzzlebox_runs",
  "puzzlebox_best",
  "puzzlebox_board_stats",
  "colorful_philosopher_posts",
] as const;

const RANK = new Map<string, number>(D1_TABLE_ORDER.map((table, i) => [table, i]));

/** The table an INSERT / UPDATE / DELETE statement writes. */
export function statementTable(sql: string): string {
  const match = /^(?:INSERT INTO|DELETE FROM|UPDATE) (\w+)/.exec(sql);
  if (!match) throw new Error(`not a write statement: ${sql.slice(0, 60)}`);
  return match[1];
}

// ------------------------------------------------------------------------------------------- plan

/** Supabase tables without env: every D1 gets every row (design 4.5, 5.1). */
export const ENVLESS_TABLES = new Set(["profile_character_nickname_pools", "puzzlebox_players"]);

/** FK children whose Postgres FK ignores env (design 5.2): the parent post table and column. */
const FK_CHILDREN: Record<string, { parent: string; column: string }> = {
  this_or_that_post_votes: { parent: "this_or_that_posts", column: "post_id" },
  this_or_that_post_likes: { parent: "this_or_that_posts", column: "post_id" },
  favorite_tournament_candidate_stats: { parent: "favorite_tournament_posts", column: "tournament_id" },
  favorite_tournament_plays: { parent: "favorite_tournament_posts", column: "tournament_id" },
};

const CHILD_TABLES: Record<string, { column: string; d1Table: string }> = {
  combo_posts: { column: "resources", d1Table: "post_combo_resources" },
  favorite_tournament_posts: { column: "pool", d1Table: "post_favorite_tournament_pool" },
};

const TS_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?([+-]\d{2}(?::?\d{2}){0,2})$/;

export interface PlannedStatement {
  /** The D1 table written (the summary fill is its own group). */
  table: string;
  statement: D1Statement;
}

export interface TableTally {
  table: string;
  /** Rows in the dump, every env. */
  dumpRows: number;
  /** Rows of this env (every row for the env-less tables). */
  envRows: number;
  copied: number;
  /** Rows of this env the design counts and does not copy: cross_env likes, orphan bodies. */
  skipped: Record<string, number>;
  /** Mapper rejects by reason (cross_env included). */
  rejects: Record<string, number>;
  /** First reject message per reason, for the report. */
  rejectSamples: Record<string, string>;
}

export interface SizeStats {
  count: number;
  max: number;
  median: number;
}

export interface FirstCopyPlan {
  env: DataEnv;
  statements: PlannedStatement[];
  tallies: TableTally[];
  /** Expected D1 rows: 'posts:<service>' for posts, else the D1 table name. */
  expected: Record<string, number>;
  checks: {
    nullTimestamps: Record<string, number>;
    craftedTimestamps: Record<string, number>;
    nonUtcTimestamps: { count: number; sample: string | null };
    craftedElements: Record<string, number>;
    envMismatchChildren: Record<string, number>;
    crossEnvLikes: number;
    orphanBodies: number;
    otherRejects: Record<string, number>;
    runs: {
      count: number;
      unreadable: string[];
      overCap: string[];
      rawBytes: SizeStats;
      listFacts: SizeStats;
      gameElements: SizeStats;
    };
    /** 'table.column' -> the largest compact JSON in bytes. */
    jsonMaxBytes: Record<string, number>;
  };
}

function utf8(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export function sizeStats(values: number[]): SizeStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const median = n === 0 ? 0 : n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return { count: n, max: sorted[n - 1] ?? 0, median };
}

function bump(record: Record<string, number>, key: string, by = 1) {
  record[key] = (record[key] ?? 0) + by;
}

/**
 * Map one env's rows. Never throws on data: anything the design counts lands in the plan's checks,
 * and stopReasons() turns the unexpected ones into a stop.
 */
export function buildFirstCopyPlan(blocks: Map<string, CopyBlock>, env: DataEnv, nowMs: number): FirstCopyPlan {
  for (const table of SUPABASE_TABLES) {
    if (!blocks.has(table)) throw new Error(`the dump has no COPY block for public.${table}`);
  }
  const envById = (table: string) => new Map(blocks.get(table)!.rows.map((row) => [String(row.id), row.env]));
  const commentEnv = envById("comments");
  const parentEnv = {
    this_or_that_posts: envById("this_or_that_posts"),
    favorite_tournament_posts: envById("favorite_tournament_posts"),
  } as Record<string, Map<string, string | null>>;

  const statements: PlannedStatement[] = [];
  const tallies: TableTally[] = [];
  const expected: Record<string, number> = {};
  const postKeys = new Set<string>();
  const threadKeys = new Set<string>();
  const checks: FirstCopyPlan["checks"] = {
    nullTimestamps: {},
    craftedTimestamps: {},
    nonUtcTimestamps: { count: 0, sample: null },
    craftedElements: {},
    envMismatchChildren: {},
    crossEnvLikes: 0,
    orphanBodies: 0,
    otherRejects: {},
    runs: {
      count: 0,
      unreadable: [],
      overCap: [],
      rawBytes: sizeStats([]),
      listFacts: sizeStats([]),
      gameElements: sizeStats([]),
    },
    jsonMaxBytes: {},
  };
  const rawSizes: number[] = [];
  const factSizes: number[] = [];
  const elementSizes: number[] = [];

  for (const table of SUPABASE_TABLES) {
    const columns = copiedColumns(table);
    const tsCols = columns.filter((c) => c.kind === "ts");
    const jsonCols = columns.filter((c) => c.kind === "json" || c.kind === "textArray" || c.kind === "intArray");
    const tally: TableTally = { table, dumpRows: 0, envRows: 0, copied: 0, skipped: {}, rejects: {}, rejectSamples: {} };
    tallies.push(tally);
    const service = POST_TABLE_SERVICES[table];
    const fkChild = FK_CHILDREN[table];

    for (const row of blocks.get(table)!.rows) {
      tally.dumpRows += 1;
      const rowEnv =
        table === "comment_likes" ? (commentEnv.get(String(row.comment_id)) ?? null) : ENVLESS_TABLES.has(table) ? env : row.env;
      if (rowEnv !== env) continue;
      tally.envRows += 1;

      // Timestamps as dumped: NULL where D1 needs a value, values canonicalTs refuses, offsets other than +00.
      let nullTs = false;
      let craftedTs = false;
      for (const c of tsCols) {
        const text = row[c.name];
        if (text === null || text === undefined) {
          if (!c.nullable) nullTs = true;
          continue;
        }
        if (canonicalTs(text) === null) craftedTs = true;
        const offset = TS_TEXT.exec(text)?.[1];
        if (offset !== undefined && offset !== "+00") {
          checks.nonUtcTimestamps.count += 1;
          checks.nonUtcTimestamps.sample ??= `${table}.${c.name} = ${text}`;
        }
      }
      if (nullTs) bump(checks.nullTimestamps, table);
      if (craftedTs) bump(checks.craftedTimestamps, table);

      let image: RowImage;
      try {
        image = imageFromPgText(table, row);
      } catch (error) {
        const reason = (error as { reason?: string }).reason ?? "check";
        bump(tally.rejects, reason);
        tally.rejectSamples[reason] ??= (error as Error).message;
        continue;
      }
      // Runs: the raw checks and the summary columns (RF2) from the raw, as the fill job computes them.
      let summaryFill: PlannedStatement | null = null;
      if (table === "runs") {
        const id = String(image.id);
        const raw = String(image.raw);
        checks.runs.count += 1;
        const bytes = utf8(raw);
        rawSizes.push(bytes);
        if (bytes > RUN_RAW_MAX_BYTES) checks.runs.overCap.push(id);
        try {
          const summary = extractRunListSummary(id, raw);
          factSizes.push(utf8(JSON.stringify(summary.list_facts)));
          elementSizes.push(utf8(JSON.stringify(summary.game_elements)));
          summaryFill = { table: SUMMARY_FILL, statement: runSummaryFillStatement(id, summary) };
        } catch {
          checks.runs.unreadable.push(id);
        }
      }
      const ctxParentEnv = fkChild ? (parentEnv[fkChild.parent].get(String(image[fkChild.column])) ?? null) : undefined;
      const result = mapRow(table, image, { nowMs, parentEnv: ctxParentEnv });
      if (!result.ok) {
        const { reason, error } = result.reject;
        bump(tally.rejects, reason);
        tally.rejectSamples[reason] ??= error;
        if (reason === "cross_env") {
          bump(tally.skipped, "cross_env");
          checks.crossEnvLikes += 1;
        }
        continue;
      }
      if (table === "defragment_bodies" && !postKeys.has(`${result.rowKey.service}\u0000${result.rowKey.post_id}`)) {
        // S12 inserts a body only under its post; an orphan is counted and not copied (design 5.2).
        bump(tally.skipped, "orphan");
        checks.orphanBodies += 1;
        continue;
      }
      tally.copied += 1;
      for (const statement of result.statements) statements.push({ table: statementTable(statement.sql), statement });

      for (const c of jsonCols) {
        const value = image[c.name];
        if (value === null || value === undefined) continue;
        const key = `${table}.${c.name}`;
        checks.jsonMaxBytes[key] = Math.max(checks.jsonMaxBytes[key] ?? 0, utf8(JSON.stringify(value)));
      }

      if (service) {
        postKeys.add(`${service}\u0000${result.rowKey.id}`);
        bump(expected, `posts:${service}`);
        bump(expected, `post_${service}`);
        const child = CHILD_TABLES[table];
        if (child) bump(expected, child.d1Table, (image[child.column] as unknown[]).length);
      } else {
        bump(expected, result.d1Table);
      }
      if (table === "likes" || table === "comments") threadKeys.add(String(image.story_id));

      if (summaryFill) {
        bump(expected, "post_history_course_file");
        statements.push(summaryFill);
      }
    }

    for (const [reason, n] of Object.entries(tally.rejects)) {
      if (reason === "cross_env") continue;
      if (reason === "bad_element") bump(checks.craftedElements, table, n);
      else if (reason === "fk" && fkChild) bump(checks.envMismatchChildren, table, n);
      // The timestamp scans above name these rows; any the scans missed still stop the copy.
      else if (reason === "bad_timestamp" && (checks.nullTimestamps[table] ?? 0) + (checks.craftedTimestamps[table] ?? 0) >= n) continue;
      else bump(checks.otherRejects, `${table}:${reason}`, n);
    }
  }
  expected.threads = threadKeys.size;
  checks.runs.rawBytes = sizeStats(rawSizes);
  checks.runs.listFacts = sizeStats(factSizes);
  checks.runs.gameElements = sizeStats(elementSizes);

  // Stable sort: rows keep their dump order inside a table, each post's child DELETE stays before its INSERT.
  const rank = (table: string) => {
    const r = RANK.get(table);
    if (r === undefined) throw new Error(`no first-copy order for D1 table ${table}`);
    return r;
  };
  statements.sort((a, b) => rank(a.table) - rank(b.table));
  return { env, statements, tallies, expected, checks };
}

/** The checks 5.2 says stop the copy (ask the user); counter drift and sizes are report-only. */
export function stopReasons(plan: FirstCopyPlan): string[] {
  const out: string[] = [];
  const list = (record: Record<string, number>) =>
    Object.entries(record)
      .map(([key, n]) => `${key} ${n}`)
      .join(", ");
  const c = plan.checks;
  if (Object.keys(c.nullTimestamps).length) out.push(`NULL data timestamps (design 10.3): ${list(c.nullTimestamps)}`);
  if (Object.keys(c.craftedTimestamps).length) out.push(`timestamps canonicalTs refuses (crafted, design 3.1): ${list(c.craftedTimestamps)}`);
  if (c.nonUtcTimestamps.count) {
    out.push(`dump not in UTC: ${c.nonUtcTimestamps.count} timestamps without +00 (e.g. ${c.nonUtcTimestamps.sample}); dump again with the session time zone UTC`);
  }
  if (Object.keys(c.craftedElements).length) out.push(`resources/pool elements that are not {type, id} strings (crafted): ${list(c.craftedElements)}`);
  if (Object.keys(c.envMismatchChildren).length) {
    out.push(`votes, plays or stats whose parent post is missing or in another env: ${list(c.envMismatchChildren)}`);
  }
  if (Object.keys(c.otherRejects).length) out.push(`rows the mapper refused: ${list(c.otherRejects)}`);
  if (c.runs.unreadable.length) out.push(`runs whose raw does not parse: ${c.runs.unreadable.length} (${c.runs.unreadable.slice(0, 5).join(", ")})`);
  if (c.runs.overCap.length) out.push(`run raws over ${RUN_RAW_MAX_BYTES} bytes: ${c.runs.overCap.length} (${c.runs.overCap.slice(0, 5).join(", ")})`);
  return out;
}

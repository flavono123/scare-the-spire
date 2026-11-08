/**
 * The shared row mapper of the D1 shadow (docs/supabase-exit/D1_SCHEMA_DESIGN.md 3, 4, 5.2, 5.3):
 * one Supabase row image -> the D1 statements that hold the same row. The first copy (Node, rows
 * from pg_dump text), the 1-minute sync Worker (rows from d1_change_log) and the rejects' re-reads all
 * use it, so every path writes the same bytes.
 *
 * Worker-safe: relative imports only, no Node APIs, no dependencies.
 *
 * A row image is the to_jsonb form of a Supabase row (what PostgREST and d1_change_log give):
 * timestamps as text, booleans, numbers, jsonb as parsed JSON, arrays as JSON arrays. Text from
 * pg_dump goes through imageFromPgText first.
 *
 * The mapper never changes a value to make it fit (design 3.1): a value D1 cannot hold is a reject
 * with the design's reason code, never a different value, a dropped element or a dropped column.
 */

import { canonicalTs } from "../d1-time";
import { parsePgArray } from "./pg-text";
import type { D1Statement, D1Value } from "./statements";

export type RowImage = Record<string, unknown>;

/** sync_rejects.reason values the mapper can decide (design 5.3). */
export type RejectReason = "bad_timestamp" | "bad_element" | "check" | "fk" | "cross_env";

export interface MapReject {
  reason: RejectReason;
  error: string;
  /** Supabase table (the mapper). */
  table: string;
  d1Table: string;
  /** The D1 key; null when the image did not even carry its key. */
  rowKey: Record<string, D1Value> | null;
}

/** Derived rows to recount after the batch's mapper statements (E13a, E13b, E14). */
export interface Touched {
  threadComments: string[];
  threadLikes: string[];
  commentLikes: string[];
}

export interface MapContext {
  /** Unix ms, for sync_pending_raw.queued_at and threads.updated_at. */
  nowMs: number;
  /**
   * The env of the parent post of an FK-child row (this-or-that like or vote, tournament play or
   * stat), when the caller knows it: the first copy from the dump, the sync from the re-read after an
   * FK error. A this-or-that like under a post of another env is 'cross_env' (design 2.2); any other
   * child is 'fk'.
   */
  parentEnv?: string | null;
}

export type MapResult =
  | {
      ok: true;
      table: string;
      d1Table: string;
      rowKey: Record<string, D1Value>;
      statements: D1Statement[];
      touched: Touched;
    }
  | { ok: false; reject: MapReject };

class MapError extends Error {
  constructor(
    readonly reason: RejectReason,
    message: string,
  ) {
    super(message);
  }
}

// ------------------------------------------------------------------------------------------- columns

type Kind = "text" | "uuid" | "ts" | "date" | "bool" | "int" | "json" | "textArray" | "intArray";

interface Col {
  /** Supabase column. */
  s: string;
  /** D1 column. */
  d: string;
  kind: Kind;
  /** NULL allowed in D1. */
  nullable: boolean;
}

function col(s: string, kind: Kind, opts: { d?: string; nullable?: boolean } = {}): Col {
  return { s, d: opts.d ?? s, kind, nullable: opts.nullable ?? false };
}

const nul = { nullable: true } as const;

const RESERVED = new Set(["character", "rows"]);

function q(name: string): string {
  return RESERVED.has(name) ? `"${name}"` : name;
}

function describe(value: unknown): string {
  const text = typeof value === "string" ? JSON.stringify(value) : String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function toD1Value(c: Col, value: unknown): D1Value {
  if (value === null || value === undefined) {
    if (c.nullable) return null;
    throw new MapError(c.kind === "ts" ? "bad_timestamp" : "check", `${c.s} is null`);
  }
  switch (c.kind) {
    case "text":
    case "uuid":
      if (typeof value === "string") return value;
      break;
    case "ts": {
      const ts = canonicalTs(value);
      if (ts) return ts;
      throw new MapError("bad_timestamp", `${c.s} is not a timestamp D1 can hold: ${describe(value)}`);
    }
    case "date":
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      break;
    case "bool":
      if (value === true) return 1;
      if (value === false) return 0;
      break;
    case "int":
      if (typeof value === "number" && Number.isSafeInteger(value)) return value;
      if (typeof value === "string" && /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
      break;
    case "json": {
      const text = JSON.stringify(value);
      if (typeof text === "string") return text;
      break;
    }
    case "textArray":
      if (Array.isArray(value) && value.every((v) => v === null || typeof v === "string")) return JSON.stringify(value);
      break;
    case "intArray":
      if (Array.isArray(value) && value.every((v) => v === null || (typeof v === "number" && Number.isSafeInteger(v)))) {
        return JSON.stringify(value);
      }
      break;
  }
  throw new MapError("check", `${c.s} is not a ${c.kind} value: ${describe(value)}`);
}

function fromPgText(c: Col, text: string): unknown {
  switch (c.kind) {
    case "bool":
      if (text === "t") return true;
      if (text === "f") return false;
      throw new MapError("check", `${c.s} is not a boolean: ${describe(text)}`);
    case "int":
      if (/^-?\d+$/.test(text) && Number.isSafeInteger(Number(text))) return Number(text);
      throw new MapError("check", `${c.s} is not a safe integer: ${describe(text)}`);
    case "json":
      try {
        return JSON.parse(text);
      } catch {
        throw new MapError("check", `${c.s} is not JSON`);
      }
    case "textArray":
    case "intArray": {
      let items: Array<string | null>;
      try {
        items = parsePgArray(text);
      } catch (error) {
        throw new MapError("check", `${c.s}: ${(error as Error).message}`);
      }
      if (c.kind === "textArray") return items;
      return items.map((item) => {
        if (item === null) return null;
        if (!/^-?\d+$/.test(item)) throw new MapError("check", `${c.s} has a non-integer element`);
        return Number(item);
      });
    }
    default:
      return text;
  }
}

// ------------------------------------------------------------------------------------------- tables

const AUTHOR = [
  col("avatar_id", "text", nul),
  col("avatar_kind", "text", nul),
  col("palette_id", "text", nul),
  col("palette_swapped", "bool", nul),
];

/** A D1 key part: a mapped column, or a constant (the service column of per-service tables). */
type KeyPart = Col | { d: string; value: string };

function isConst(part: KeyPart): part is { d: string; value: string } {
  return "value" in part;
}

interface SimpleSpec {
  kind: "simple";
  table: string;
  d1Table: string;
  key: KeyPart[];
  cols: Col[];
  /** Constant non-key D1 columns. */
  consts?: Array<{ d: string; value: string }>;
  /** Supabase columns that are not copied (env, dead columns). */
  drop: string[];
  touched?: (image: RowImage) => Partial<Touched>;
  /** FK-child tables whose parent can sit in another env in Supabase (design 2.2, 5.2). */
  parentEnvCheck?: "cross_env" | "fk";
}

interface PostSpec {
  kind: "post";
  table: string;
  service: string;
  serviceTable: string;
  /** Columns that land in posts (D1 names are posts columns). */
  postCols: Col[];
  /** Columns that land in post_<service>. */
  serviceCols: Col[];
  drop: string[];
  child?: { s: string; d1Table: string };
  /** posts.summary = left(btrim(<expr>), 120) of get_defragment_feed_v2 (design 4.3). */
  summary: { inputs: string[]; js: (image: RowImage) => string; sql: string };
  /** runs only: the column d1_change_log leaves out (heavy_changed) and the file table holds. */
  heavy?: string;
}

interface BodySpec {
  kind: "body";
  table: "defragment_bodies";
  d1Table: "defragment_bodies";
  key: Col[];
  cols: Col[];
  drop: string[];
}

type TableSpec = SimpleSpec | PostSpec | BodySpec;

/** btrim(x) (spaces only) then left(x, 120) in characters, as Postgres and SQLite count them. */
export function summaryText(value: string): string {
  return Array.from(value.replace(/^ +| +$/g, "")).slice(0, 120).join("");
}

function nullIfEmpty(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const POST_AUTHOR_COLS = [
  col("user_id", "uuid"),
  col("nickname", "text"),
  ...AUTHOR,
  col("like_count", "int"),
  col("comment_count", "int"),
  col("created_at", "ts"),
];

function post(
  table: string,
  service: string,
  opts: {
    title?: "nullable" | "required";
    userNullable?: boolean;
    serviceCols: Col[];
    drop?: string[];
    child?: string;
    summary: PostSpec["summary"];
  },
): PostSpec {
  const postCols = POST_AUTHOR_COLS.map((c) => (c.s === "user_id" && opts.userNullable ? { ...c, nullable: true } : c));
  if (opts.title) postCols.push(col("title", "text", { nullable: opts.title === "nullable" }));
  return {
    kind: "post",
    table,
    service,
    serviceTable: `post_${service}`,
    postCols,
    serviceCols: opts.serviceCols,
    drop: ["env", ...(opts.drop ?? [])],
    child: opts.child ? { s: opts.child, d1Table: `post_${service}_${opts.child}` } : undefined,
    summary: opts.summary,
  };
}

const SUMMARY_CONTENT_TEXT: PostSpec["summary"] = {
  inputs: ["content_text"],
  js: (row) => summaryText(str(row.content_text)),
  sql: "s.content_text",
};

const SUMMARY_TITLE_NOTE: PostSpec["summary"] = {
  inputs: ["title", "note"],
  js: (row) => summaryText(nullIfEmpty(row.title) ?? str(row.note)),
  sql: "coalesce(nullif(posts.title, ''), s.note)",
};

const TABLES: TableSpec[] = [
  // ------------------------------------------------------------------ 0004 engagement
  {
    kind: "simple",
    table: "comments",
    d1Table: "comments",
    key: [col("id", "uuid")],
    cols: [
      col("story_id", "text"),
      col("user_id", "uuid"),
      col("nickname", "text"),
      ...AUTHOR,
      col("content", "text"),
      col("content_blocks", "json", nul),
      col("created_at", "ts"),
    ],
    drop: ["env", "parent_id", "meta"],
    touched: (row) => (typeof row.story_id === "string" ? { threadComments: [row.story_id] } : {}),
  },
  {
    kind: "simple",
    table: "comment_likes",
    d1Table: "comment_likes",
    key: [col("comment_id", "uuid"), col("user_id", "uuid")],
    cols: [col("created_at", "ts")],
    drop: ["id"],
    touched: (row) => (typeof row.comment_id === "string" ? { commentLikes: [row.comment_id] } : {}),
  },
  {
    kind: "simple",
    table: "likes",
    d1Table: "likes",
    key: [col("story_id", "text"), col("user_id", "uuid")],
    cols: [col("created_at", "ts")],
    drop: ["id", "env", "reaction_type"],
    touched: (row) => (typeof row.story_id === "string" ? { threadLikes: [row.story_id] } : {}),
  },
  {
    kind: "simple",
    table: "resource_reactions",
    d1Table: "resource_reactions",
    key: [col("resource_id", "text"), col("resource_type", "text"), col("game_version", "text"), col("user_id", "uuid")],
    cols: [col("kind", "text")],
    drop: ["env"],
  },
  {
    kind: "simple",
    table: "resource_reaction_counts",
    d1Table: "resource_reaction_counts",
    key: [col("resource_id", "text"), col("resource_type", "text"), col("game_version", "text")],
    cols: [col("buff_count", "int"), col("nerf_count", "int"), col("rework_count", "int")],
    drop: ["env"],
  },
  {
    kind: "simple",
    table: "community_stories",
    d1Table: "community_stories",
    key: [col("id", "uuid")],
    cols: [
      col("user_id", "uuid", nul),
      col("static_story_id", "text", nul),
      col("nickname", "text"),
      ...AUTHOR,
      col("sentence", "text"),
      col("game", "text"),
      col("entity_type", "text", nul),
      col("entity_id", "text", nul),
      col("change_id", "text", nul),
      col("patch_line_id", "text", nul),
      col("source", "text", nul),
      col("tags", "json"),
      col("linked_entities", "json"),
      col("created_at", "ts"),
    ],
    drop: ["env"],
  },

  // ------------------------------------------------------------------ 0005 posts
  post("chemical_posts", "chemical_x", {
    serviceCols: [col("content", "json"), col("content_text", "text")],
    summary: SUMMARY_CONTENT_TEXT,
  }),
  post("combo_posts", "combo", {
    serviceCols: [col("content", "json"), col("content_text", "text")],
    child: "resources",
    summary: SUMMARY_CONTENT_TEXT,
  }),
  post("transfigure_posts", "transfigure", {
    title: "nullable",
    serviceCols: [
      col("resource_type", "text"),
      col("resource_id", "text"),
      col("source_text", "text"),
      col("content", "json"),
      col("content_text", "text"),
      col("transformed_name", "text", nul),
      col("transformed_cost", "text", nul),
      col("transformed_star_cost", "text", nul),
      col("upgraded_content", "json", nul),
      col("upgraded_content_text", "text", nul),
      col("transformed_upgrade_cost", "text", nul),
      col("transformed_upgrade_star_cost", "text", nul),
      col("show_upgrade", "bool"),
      col("omit_energy_cost", "bool", nul),
      col("card_top_keywords", "textArray"),
      col("card_bottom_keywords", "textArray"),
      col("upgraded_card_top_keywords", "textArray"),
      col("upgraded_card_bottom_keywords", "textArray"),
      col("transformed_card_type", "text", nul),
      col("transformed_card_rarity", "text", nul),
      col("transformed_card_color", "text", nul),
      col("token_color", "text", nul),
      col("token_wax", "text", nul),
      col("extra_variants", "json"),
    ],
    drop: ["source_game_locale"],
    summary: {
      inputs: ["title", "transformed_name", "content_text"],
      js: (row) => summaryText(nullIfEmpty(row.title) ?? nullIfEmpty(row.transformed_name) ?? str(row.content_text)),
      sql: "coalesce(nullif(posts.title, ''), nullif(s.transformed_name, ''), s.content_text)",
    },
  }),
  post("this_or_that_posts", "this_or_that", {
    serviceCols: [
      col("left_type", "text"),
      col("left_id", "text"),
      col("right_type", "text"),
      col("right_id", "text"),
      col("reason", "text"),
      col("left_vote_count", "int"),
      col("right_vote_count", "int"),
    ],
    drop: ["vote_rate_bps"],
    summary: { inputs: ["reason"], js: (row) => summaryText(str(row.reason)), sql: "s.reason" },
  }),
  post("favorite_tournament_posts", "favorite_tournament", {
    title: "required",
    userNullable: true,
    serviceCols: [col("note", "text"), col("preset_key", "text"), col("play_count", "int")],
    drop: ["game_version"],
    child: "pool",
    summary: SUMMARY_TITLE_NOTE,
  }),
  post("decisions_decisions_posts", "decisions_decisions", {
    title: "required",
    serviceCols: [
      col("note", "text"),
      col("preset_key", "text"),
      col("game_version", "text"),
      col("rows", "json"),
      col("placements", "json"),
      col("extra_ids", "json"),
    ],
    summary: SUMMARY_TITLE_NOTE,
  }),
  post("pagestorm_posts", "pagestorm", {
    title: "required",
    serviceCols: [col("content", "json"), col("content_text", "text")],
    summary: {
      inputs: ["title", "content_text"],
      js: (row) => summaryText(nullIfEmpty(row.title) ?? str(row.content_text)),
      sql: "coalesce(nullif(posts.title, ''), s.content_text)",
    },
  }),
  {
    kind: "post",
    table: "runs",
    service: "history_course",
    serviceTable: "post_history_course",
    postCols: [
      col("donor_user_id", "uuid", { d: "user_id", nullable: true }),
      col("donor_nickname", "text", { d: "nickname" }),
      col("like_count", "int"),
      col("comment_count", "int"),
      col("created_at", "ts"),
    ],
    serviceCols: [
      col("seed", "text"),
      col("build", "text"),
      col("character", "text"),
      col("ascension", "int"),
      col("win", "bool"),
      col("start_time", "int", nul),
      col("run_time", "int", nul),
      col("acts_count", "int"),
      col("total_floors", "int"),
      col("cover_spec", "json", nul),
    ],
    // Summary columns and badges are built in D1 from the raw (design 4.4, 10.2), never copied.
    drop: ["env", "badges", "highlight_card", "highlight_relic", "note_blocks"],
    summary: {
      inputs: ["seed"],
      js: (row) => summaryText(nullIfEmpty(row.seed) ?? str(row.id)),
      sql: "coalesce(nullif(s.seed, ''), posts.id)",
    },
    heavy: "raw",
  },
  {
    kind: "simple",
    table: "this_or_that_post_votes",
    d1Table: "this_or_that_post_votes",
    key: [{ d: "service", value: "this_or_that" }, col("post_id", "uuid"), col("user_id", "uuid")],
    cols: [col("choice", "text"), col("created_at", "ts")],
    drop: ["env", "created_surface"],
    parentEnvCheck: "fk",
  },
  {
    kind: "simple",
    table: "this_or_that_post_likes",
    d1Table: "this_or_that_post_likes",
    key: [{ d: "service", value: "this_or_that" }, col("post_id", "uuid"), col("user_id", "uuid")],
    cols: [col("created_at", "ts")],
    drop: ["id", "env"],
    parentEnvCheck: "cross_env",
  },
  {
    kind: "simple",
    table: "favorite_tournament_candidate_stats",
    d1Table: "favorite_tournament_candidate_stats",
    key: [
      { d: "service", value: "favorite_tournament" },
      col("tournament_id", "uuid"),
      col("resource_type", "text"),
      col("resource_id", "text"),
    ],
    cols: [
      col("match_appearances", "int"),
      col("match_wins", "int"),
      col("championships", "int"),
      col("current_rank", "int", nul),
      col("rank_history", "json"),
    ],
    drop: ["env"],
    parentEnvCheck: "fk",
  },
  {
    kind: "simple",
    table: "favorite_tournament_plays",
    d1Table: "favorite_tournament_plays",
    key: [col("id", "uuid")],
    consts: [{ d: "service", value: "favorite_tournament" }],
    cols: [
      col("tournament_id", "uuid"),
      col("user_id", "uuid"),
      col("starting_size", "int"),
      col("champion_type", "text"),
      col("champion_id", "text"),
      col("matches", "json"),
      col("created_at", "ts"),
    ],
    drop: ["env"],
    parentEnvCheck: "fk",
  },
  {
    kind: "simple",
    table: "pagestorm_drafts",
    d1Table: "pagestorm_drafts",
    key: [col("id", "uuid")],
    cols: [
      col("user_id", "uuid"),
      col("nickname", "text"),
      ...AUTHOR,
      col("title", "text"),
      col("content", "json"),
      col("content_text", "text"),
      col("created_at", "ts"),
      col("updated_at", "ts"),
    ],
    drop: ["env"],
  },
  {
    kind: "body",
    table: "defragment_bodies",
    d1Table: "defragment_bodies",
    key: [col("source_service", "text", { d: "service" }), col("source_id", "uuid", { d: "post_id" })],
    cols: [
      col("user_id", "uuid"),
      col("nickname", "text"),
      col("content", "json"),
      col("content_text", "text"),
      col("created_at", "ts"),
      col("updated_at", "ts"),
    ],
    drop: ["env"],
  },

  // ------------------------------------------------------------------ 0006 profile, contact, puzzlebox, philosophers
  {
    kind: "simple",
    table: "profile_character_nickname_pools",
    d1Table: "profile_character_nickname_pools",
    key: [col("character_id", "text"), col("locale", "text")],
    cols: [col("nicknames", "textArray"), col("updated_at", "ts")],
    drop: [],
  },
  {
    kind: "simple",
    table: "contact_inquiries",
    d1Table: "contact_inquiries",
    key: [col("id", "uuid")],
    cols: [
      col("user_id", "uuid", nul),
      col("category", "text"),
      col("message", "text"),
      col("reply_email", "text", nul),
      col("page_path", "text"),
      col("service_locale", "text"),
      col("game_locale", "text"),
      col("status", "text"),
      col("created_at", "ts"),
      col("admin_response", "text", nul),
      col("responded_at", "ts", nul),
      col("reply_seen_at", "ts", nul),
    ],
    drop: ["env", "viewport_width", "viewport_height"],
  },
  {
    kind: "simple",
    table: "puzzlebox_runs",
    d1Table: "puzzlebox_runs",
    key: [col("id", "int")],
    cols: [
      col("game", "text"),
      col("board", "text"),
      col("user_id", "uuid"),
      col("attempt", "int"),
      col("score", "int"),
      col("perfect", "bool"),
      col("run", "json"),
      col("created_at", "ts"),
    ],
    drop: ["env"],
  },
  {
    kind: "simple",
    table: "puzzlebox_players",
    d1Table: "puzzlebox_players",
    key: [col("user_id", "uuid")],
    cols: [
      col("nickname", "text"),
      col("avatar_id", "text", nul),
      col("avatar_kind", "text", nul),
      col("palette_id", "text", nul),
      col("palette_swapped", "bool"),
      col("hidden", "bool"),
      col("updated_at", "ts"),
    ],
    drop: [],
  },
  {
    kind: "simple",
    table: "puzzlebox_best",
    d1Table: "puzzlebox_best",
    key: [col("game", "text"), col("board", "text"), col("user_id", "uuid")],
    cols: [
      col("score", "int"),
      col("perfect", "bool"),
      col("run_id", "int"),
      col("achieved_at", "ts"),
      col("attempts", "int"),
    ],
    drop: ["env"],
  },
  {
    kind: "simple",
    table: "puzzlebox_board_stats",
    d1Table: "puzzlebox_board_stats",
    key: [col("game", "text"), col("board", "text")],
    cols: [
      col("players", "int"),
      col("cleared", "int"),
      col("perfect", "int"),
      col("score_sum", "int"),
      col("mistakes_sum", "int"),
      col("rocks_sum", "int"),
      col("purple_first", "int"),
      col("level_solved", "intArray"),
      col("question_wrong", "intArray"),
      col("wrong_picks", "intArray"),
      col("speed_sum", "int"),
    ],
    drop: ["env"],
  },
  {
    kind: "simple",
    table: "colorful_philosopher_posts",
    d1Table: "colorful_philosopher_posts",
    key: [col("id", "uuid")],
    cols: [
      col("week_start", "date"),
      col("slot", "text"),
      col("resource_type", "text"),
      col("resource_id", "text"),
      col("name_ko", "text"),
      col("name_en", "text"),
      col("image_url", "text", nul),
      col("body", "text"),
      col("game_version", "text"),
      col("created_at", "ts"),
    ],
    drop: ["env", "buff_count", "nerf_count", "rework_count"],
  },
];

const SPEC_BY_TABLE = new Map(TABLES.map((spec) => [spec.table, spec]));

/** The 27 Supabase tables the design copies (design 5.1), in the first copy's parent-first order. */
export const SUPABASE_TABLES: readonly string[] = TABLES.map((spec) => spec.table);

/** Supabase post table -> API service id (posts.service). */
export const POST_TABLE_SERVICES: Readonly<Record<string, string>> = Object.fromEntries(
  TABLES.filter((spec): spec is PostSpec => spec.kind === "post").map((spec) => [spec.table, spec.service]),
);

function specOf(table: string): TableSpec {
  const spec = SPEC_BY_TABLE.get(table);
  if (!spec) throw new Error(`no D1 mapper for Supabase table ${table}`);
  return spec;
}

function d1TableOf(spec: TableSpec): string {
  return spec.kind === "post" ? "posts" : spec.d1Table;
}

/** The D1 table a Supabase table's key lives in (sync_rejects.d1_table). */
export function d1TableFor(table: string): string {
  return d1TableOf(specOf(table));
}

function allCols(spec: TableSpec): Col[] {
  if (spec.kind === "post") return [col("id", "text"), ...spec.postCols, ...spec.serviceCols];
  if (spec.kind === "body") return [...spec.key, ...spec.cols];
  return [...spec.key.filter((part): part is Col => !isConst(part)), ...spec.cols];
}

const COLS_BY_TABLE = new Map(
  TABLES.map((spec) => {
    const byName = new Map(allCols(spec).map((c) => [c.s, c]));
    if (spec.kind === "post" && spec.child) byName.set(spec.child.s, col(spec.child.s, "json"));
    if (spec.kind === "post" && spec.heavy) byName.set(spec.heavy, col(spec.heavy, "text"));
    return [spec.table, byName] as const;
  }),
);

/** The env a row image belongs to, or null for the tables without env (and comment_likes). */
export function rowEnv(image: RowImage | null | undefined): string | null {
  return image && typeof image.env === "string" ? image.env : null;
}

/**
 * pg_dump COPY text values (column -> text, null for \N) -> the row image the mapper takes: booleans
 * from 't'/'f', integers, jsonb parsed, text[] and int[] as arrays. Unknown columns are an error.
 */
export function imageFromPgText(table: string, fields: Record<string, string | null>): RowImage {
  const spec = specOf(table);
  const byName = COLS_BY_TABLE.get(table)!;
  const image: RowImage = {};
  for (const [name, text] of Object.entries(fields)) {
    if (spec.drop.includes(name)) {
      image[name] = text;
      continue;
    }
    const c = byName.get(name);
    if (!c) throw new MapError("check", `unknown column ${table}.${name}`);
    image[name] = text === null ? null : fromPgText(c, text);
  }
  return image;
}

// ------------------------------------------------------------------------------------------- keys

function keyOf(spec: TableSpec, image: RowImage): Record<string, D1Value> {
  if (spec.kind === "post") return { service: spec.service, id: toD1Value(col("id", "text"), image.id) };
  const key: Record<string, D1Value> = {};
  for (const part of spec.key) {
    key[part.d] = isConst(part) ? part.value : toD1Value(part, image[part.s]);
  }
  return key;
}

function keySupabaseCols(spec: TableSpec): string[] {
  if (spec.kind === "post") return ["id"];
  return (spec.key as KeyPart[]).filter((part): part is Col => !isConst(part)).map((part) => part.s);
}

// ------------------------------------------------------------------------------------------- merging

export type ChangeOp = "I" | "U" | "D";

/** One d1_change_log row (design 5.1): I = whole row, U = changed columns (old_row: the old row), D = old row. */
export interface ChangeEntry {
  id: number;
  table: string;
  op: ChangeOp;
  newRow?: RowImage | null;
  oldRow?: RowImage | null;
  /** The heavy column (runs.raw) changed; it is left out of both images. */
  heavyChanged?: boolean;
}

export interface MergedChange {
  table: string;
  d1Table: string;
  rowKey: Record<string, D1Value>;
  keyText: string;
  /** upsert = a whole row, update = changed columns of a row D1 should already hold, delete = gone. */
  action: "upsert" | "update" | "delete";
  /** The whole row (upsert), the changed columns (update), or null (delete). */
  image: RowImage | null;
  /** Old row images seen for this key (U, D): their thread keys are recounted too. */
  priorImages: RowImage[];
  heavyChanged: boolean;
  /** Change-log ids folded into this change, ascending. */
  ids: number[];
}

/**
 * Collapse change-log rows by (table, D1 key) in id order (design 5.3 item 4): I is the whole row,
 * U overlays its columns, D marks a delete, I after D is the whole row again. A key that ends in D is
 * only deleted. The result is ordered by each change's first id. An entry whose key cannot be read is
 * a reject.
 */
export function mergeChanges(entries: readonly ChangeEntry[]): {
  changes: MergedChange[];
  rejects: Array<MapReject & { ids: number[] }>;
} {
  const sorted = [...entries].sort((a, b) => a.id - b.id);
  const byKey = new Map<string, MergedChange>();
  const rejects: Array<MapReject & { ids: number[] }> = [];
  for (const entry of sorted) {
    const spec = specOf(entry.table);
    const d1Table = d1TableOf(spec);
    let rowKey: Record<string, D1Value>;
    try {
      rowKey = entryKey(spec, entry);
    } catch (error) {
      rejects.push({ ...toReject(error, spec, null), ids: [entry.id] });
      continue;
    }
    const keyText = `${entry.table}\u0000${JSON.stringify(rowKey)}`;
    const current = byKey.get(keyText);
    if (!current) {
      byKey.set(keyText, {
        table: entry.table,
        d1Table,
        rowKey,
        keyText: JSON.stringify(rowKey),
        action: entry.op === "I" ? "upsert" : entry.op === "U" ? "update" : "delete",
        image: entry.op === "D" ? null : { ...(entry.newRow ?? {}) },
        priorImages: entry.oldRow ? [entry.oldRow] : [],
        heavyChanged: entry.op === "U" && Boolean(entry.heavyChanged),
        ids: [entry.id],
      });
      continue;
    }
    current.ids.push(entry.id);
    if (entry.oldRow) current.priorImages.push(entry.oldRow);
    if (entry.op === "D") {
      current.action = "delete";
      current.image = null;
      current.heavyChanged = false;
    } else if (entry.op === "I") {
      current.action = "upsert";
      current.image = { ...(entry.newRow ?? {}) };
      current.heavyChanged = false;
    } else {
      if (current.action === "delete") current.action = "update";
      current.image = { ...(current.image ?? {}), ...(entry.newRow ?? {}) };
      current.heavyChanged = current.heavyChanged || Boolean(entry.heavyChanged);
    }
  }
  const changes = [...byKey.values()].sort((a, b) => a.ids[0] - b.ids[0]);
  rejects.sort((a, b) => a.ids[0] - b.ids[0]);
  return { changes, rejects };
}

function entryKey(spec: TableSpec, entry: ChangeEntry): Record<string, D1Value> {
  if (entry.op === "I") {
    if (!entry.newRow) throw new MapError("check", "I without a row");
    return keyOf(spec, entry.newRow);
  }
  if (entry.op === "D") {
    if (!entry.oldRow) throw new MapError("check", "D without the old row");
    return keyOf(spec, entry.oldRow);
  }
  const keyCols = keySupabaseCols(spec);
  const newRow = entry.newRow ?? {};
  if (entry.oldRow) {
    for (const name of keyCols) {
      if (name in newRow && newRow[name] !== entry.oldRow[name]) {
        throw new MapError("check", `U changes the key column ${name}`);
      }
    }
    return keyOf(spec, entry.oldRow);
  }
  if (!keyCols.every((name) => name in newRow)) throw new MapError("check", "U without its key columns");
  return keyOf(spec, newRow);
}

// ------------------------------------------------------------------------------------------- mapping

function emptyTouched(): Touched {
  return { threadComments: [], threadLikes: [], commentLikes: [] };
}

function toReject(error: unknown, spec: TableSpec, rowKey: Record<string, D1Value> | null): MapReject {
  if (error instanceof MapError) {
    return { reason: error.reason, error: error.message, table: spec.table, d1Table: d1TableOf(spec), rowKey };
  }
  throw error;
}

/** Map one merged change to its D1 statements, or a reject. */
export function mapChange(change: MergedChange, ctx: MapContext): MapResult {
  const spec = specOf(change.table);
  try {
    const statements =
      spec.kind === "post"
        ? mapPost(spec, change, ctx)
        : spec.kind === "body"
          ? mapBody(spec, change)
          : mapSimple(spec, change, ctx);
    return {
      ok: true,
      table: change.table,
      d1Table: change.d1Table,
      rowKey: change.rowKey,
      statements,
      touched: touchedOf(spec, change),
    };
  } catch (error) {
    return { ok: false, reject: toReject(error, spec, change.rowKey) };
  }
}

/** A whole row (first copy, a re-read) as an upsert. */
export function mapRow(table: string, image: RowImage, ctx: MapContext): MapResult {
  const spec = specOf(table);
  let rowKey: Record<string, D1Value>;
  try {
    rowKey = keyOf(spec, image);
  } catch (error) {
    return { ok: false, reject: toReject(error, spec, null) };
  }
  return mapChange(
    {
      table,
      d1Table: d1TableOf(spec),
      rowKey,
      keyText: JSON.stringify(rowKey),
      action: "upsert",
      image,
      priorImages: [],
      heavyChanged: false,
      ids: [],
    },
    ctx,
  );
}

/** A row gone from Supabase (a re-read that found nothing) as a delete by key. */
export function mapDelete(table: string, oldImage: RowImage, ctx: MapContext): MapResult {
  const spec = specOf(table);
  let rowKey: Record<string, D1Value>;
  try {
    rowKey = keyOf(spec, oldImage);
  } catch (error) {
    return { ok: false, reject: toReject(error, spec, null) };
  }
  return mapChange(
    {
      table,
      d1Table: d1TableOf(spec),
      rowKey,
      keyText: JSON.stringify(rowKey),
      action: "delete",
      image: null,
      priorImages: [oldImage],
      heavyChanged: false,
      ids: [],
    },
    ctx,
  );
}

/** pg_dump text values -> a whole-row upsert (the first copy). */
export function mapPgTextRow(table: string, fields: Record<string, string | null>, ctx: MapContext): MapResult {
  const spec = specOf(table);
  let image: RowImage;
  try {
    image = imageFromPgText(table, fields);
  } catch (error) {
    return { ok: false, reject: toReject(error, spec, null) };
  }
  return mapRow(table, image, ctx);
}

function touchedOf(spec: TableSpec, change: MergedChange): Touched {
  const touched = emptyTouched();
  if (spec.kind !== "simple" || !spec.touched) return touched;
  const images = [...change.priorImages, ...(change.image ? [change.image] : [])];
  // A partial U of comment_likes or likes still names its key through the merged key.
  if (spec.table === "comment_likes") touched.commentLikes.push(String(change.rowKey.comment_id));
  if (spec.table === "likes") touched.threadLikes.push(String(change.rowKey.story_id));
  for (const image of images) {
    const part = spec.touched(image);
    touched.threadComments.push(...(part.threadComments ?? []));
    touched.threadLikes.push(...(part.threadLikes ?? []));
    touched.commentLikes.push(...(part.commentLikes ?? []));
  }
  return dedupeTouched(touched);
}

function dedupeTouched(touched: Touched): Touched {
  return {
    threadComments: [...new Set(touched.threadComments)],
    threadLikes: [...new Set(touched.threadLikes)],
    commentLikes: [...new Set(touched.commentLikes)],
  };
}

/** Changed mapped columns of a partial image (key, dropped and unknown columns handled). */
function changedCols(spec: TableSpec, cols: Col[], image: RowImage): Col[] {
  const known = COLS_BY_TABLE.get(spec.table)!;
  for (const name of Object.keys(image)) {
    if (!known.has(name) && !spec.drop.includes(name)) throw new MapError("check", `unknown column ${spec.table}.${name}`);
  }
  return cols.filter((c) => c.s in image);
}

function requireCols(spec: TableSpec, cols: Col[], image: RowImage) {
  for (const c of cols) {
    if (!(c.s in image)) throw new MapError("check", `whole row of ${spec.table} misses ${c.s}`);
  }
  changedCols(spec, cols, image);
}

function placeholders(from: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `?${from + i}`).join(", ");
}

function keyWhere(parts: Array<{ d: string }>, from: number): string {
  return parts.map((part, i) => `${q(part.d)} = ?${from + i}`).join(" AND ");
}

function checkParentEnv(spec: SimpleSpec, change: MergedChange, ctx: MapContext) {
  if (!spec.parentEnvCheck || ctx.parentEnv === undefined || change.action === "delete") return;
  const env = rowEnv(change.image) ?? change.priorImages.map(rowEnv).find((value) => value !== null) ?? null;
  if (ctx.parentEnv === null) throw new MapError("fk", `the parent of this ${spec.table} row is missing in Supabase`);
  if (env !== null && env !== ctx.parentEnv) {
    throw new MapError(
      spec.parentEnvCheck,
      `${spec.table} row of env ${env} points at a post of env ${ctx.parentEnv}`,
    );
  }
}

function mapSimple(spec: SimpleSpec, change: MergedChange, ctx: MapContext): D1Statement[] {
  const keyParts = spec.key;
  const keyValues = keyParts.map((part) => change.rowKey[part.d]);
  if (change.action === "delete") {
    return [{ sql: `DELETE FROM ${spec.d1Table} WHERE ${keyWhere(keyParts, 1)}`, params: keyValues }];
  }
  checkParentEnv(spec, change, ctx);
  const image = change.image ?? {};
  if (change.action === "update") {
    const cols = changedCols(spec, spec.cols, image);
    if (cols.length === 0) return [];
    const values = cols.map((c) => toD1Value(c, image[c.s]));
    const set = cols.map((c, i) => `${q(c.d)} = ?${i + 1}`).join(", ");
    return [
      {
        sql: `UPDATE ${spec.d1Table} SET ${set} WHERE ${keyWhere(keyParts, cols.length + 1)}`,
        params: [...values, ...keyValues],
        zeroRows: "zero_rows",
      },
    ];
  }
  requireCols(spec, spec.cols, image);
  const consts = spec.consts ?? [];
  const names = [...consts.map((c) => c.d), ...keyParts.map((part) => part.d), ...spec.cols.map((c) => c.d)];
  const params: D1Value[] = [
    ...consts.map((c) => c.value),
    ...keyValues,
    ...spec.cols.map((c) => toD1Value(c, image[c.s])),
  ];
  const conflict = keyParts.map((part) => q(part.d)).join(", ");
  const update = spec.cols.map((c) => `${q(c.d)} = excluded.${q(c.d)}`).join(", ");
  return [
    {
      sql:
        `INSERT INTO ${spec.d1Table} (${names.map(q).join(", ")}) VALUES (${placeholders(1, names.length)}) ` +
        `ON CONFLICT (${conflict}) DO ${update ? `UPDATE SET ${update}` : "NOTHING"}`,
      params,
    },
  ];
}

function mapBody(spec: BodySpec, change: MergedChange): D1Statement[] {
  const service = change.rowKey.service;
  const postId = change.rowKey.post_id;
  if (change.action === "delete") {
    return [{ sql: "DELETE FROM defragment_bodies WHERE service = ?1 AND post_id = ?2", params: [service, postId] }];
  }
  const image = change.image ?? {};
  if (change.action === "update") {
    const cols = changedCols(spec, spec.cols, image);
    if (cols.length === 0) return [];
    const set = cols.map((c, i) => `${c.d} = ?${i + 1}`).join(", ");
    return [
      {
        sql: `UPDATE defragment_bodies SET ${set} WHERE service = ?${cols.length + 1} AND post_id = ?${cols.length + 2}`,
        params: [...cols.map((c) => toD1Value(c, image[c.s])), service, postId],
        zeroRows: "zero_rows",
      },
    ];
  }
  requireCols(spec, spec.cols, image);
  const [userId, nickname, content, contentText, createdAt, updatedAt] = spec.cols.map((c) => toD1Value(c, image[c.s]));
  // S12: only under an existing post; 0 rows -> re-read Supabase, still no post -> orphan.
  return [
    {
      sql:
        "INSERT INTO defragment_bodies (service, post_id, user_id, nickname, content, content_text, created_at, updated_at) " +
        "SELECT ?2, ?1, ?3, ?4, ?5, ?6, ?7, ?8 WHERE EXISTS (SELECT 1 FROM posts WHERE service = ?2 AND id = ?1) " +
        "ON CONFLICT (service, post_id) DO UPDATE SET user_id = excluded.user_id, nickname = excluded.nickname, " +
        "content = excluded.content, content_text = excluded.content_text, created_at = excluded.created_at, " +
        "updated_at = excluded.updated_at",
      params: [postId, service, userId, nickname, content, contentText, createdAt, updatedAt],
      zeroRows: "orphan",
    },
  ];
}

const POSTS_COLUMNS = [
  "user_id",
  "nickname",
  "avatar_id",
  "avatar_kind",
  "palette_id",
  "palette_swapped",
  "title",
  "summary",
  "like_count",
  "comment_count",
  "created_at",
] as const;

/** The raw .run file cap of post_history_course_file (design 4.4, 10.8). */
export const RUN_RAW_MAX_BYTES = 1_900_000;

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function childElements(spec: PostSpec, value: unknown): string {
  if (!Array.isArray(value)) throw new MapError("bad_element", `${spec.child!.s} is not an array`);
  value.forEach((element, index) => {
    const ok =
      element !== null &&
      typeof element === "object" &&
      !Array.isArray(element) &&
      typeof (element as Record<string, unknown>).type === "string" &&
      typeof (element as Record<string, unknown>).id === "string" &&
      Object.keys(element).every((name) => name === "type" || name === "id");
    if (!ok) {
      throw new MapError("bad_element", `${spec.child!.s}[${index}] is not {"type": string, "id": string}: ${describe(JSON.stringify(element))}`);
    }
  });
  return JSON.stringify(value);
}

function childStatements(spec: PostSpec, postId: D1Value, elements: string): D1Statement[] {
  const child = spec.child!.d1Table;
  return [
    // S8, S9 (resources) and the same pair for the tournament pool: replace by array index.
    { sql: `DELETE FROM ${child} WHERE service = '${spec.service}' AND post_id = ?1`, params: [postId] },
    {
      sql:
        `INSERT INTO ${child} (service, post_id, ord, resource_type, resource_id) ` +
        `SELECT '${spec.service}', ?1, CAST(key AS INTEGER), json_extract(value, '$.type'), json_extract(value, '$.id') ` +
        "FROM json_each(?2) WHERE true " +
        "ON CONFLICT (service, post_id, ord) DO UPDATE SET resource_type = excluded.resource_type, resource_id = excluded.resource_id",
      params: [postId, elements],
    },
  ];
}

function queueRawStatement(postId: D1Value, ctx: MapContext): D1Statement {
  // S13b
  return {
    sql:
      "INSERT INTO sync_pending_raw (post_id, queued_at) VALUES (?1, ?2) " +
      "ON CONFLICT (post_id) DO UPDATE SET queued_at = min(sync_pending_raw.queued_at, excluded.queued_at)",
    params: [postId, ctx.nowMs],
  };
}

function rawFile(raw: unknown): string {
  if (typeof raw !== "string") throw new MapError("check", "raw is not text");
  if (utf8Length(raw) > RUN_RAW_MAX_BYTES) throw new MapError("check", `raw is over ${RUN_RAW_MAX_BYTES} bytes`);
  return raw;
}

function mapPost(spec: PostSpec, change: MergedChange, ctx: MapContext): D1Statement[] {
  const service = spec.service;
  const postId = change.rowKey.id;
  if (change.action === "delete") {
    // S10: cascades the service row, its children, votes, likes, plays, stats, the body and the run file.
    return [{ sql: "DELETE FROM posts WHERE service = ?2 AND id = ?1", params: [postId, service] }];
  }
  const image = change.image ?? {};
  if (change.action === "update") return mapPostUpdate(spec, change, image, ctx);

  requireCols(spec, [...spec.postCols, ...spec.serviceCols], image);
  if (spec.child && !(spec.child.s in image)) throw new MapError("check", `whole row of ${spec.table} misses ${spec.child.s}`);
  const values: Record<string, D1Value> = Object.fromEntries(POSTS_COLUMNS.map((name) => [name, null]));
  for (const c of spec.postCols) values[c.d] = toD1Value(c, image[c.s]);
  values.summary = spec.summary.js(image);
  const statements: D1Statement[] = [
    {
      // S7 with every column bound.
      sql:
        "INSERT INTO posts (service, id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, title, summary, " +
        "like_count, comment_count, created_at) VALUES (?2, ?1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) " +
        "ON CONFLICT (service, id) DO UPDATE SET user_id = excluded.user_id, nickname = excluded.nickname, " +
        "avatar_id = excluded.avatar_id, avatar_kind = excluded.avatar_kind, palette_id = excluded.palette_id, " +
        "palette_swapped = excluded.palette_swapped, title = excluded.title, summary = excluded.summary, " +
        "like_count = excluded.like_count, comment_count = excluded.comment_count, created_at = excluded.created_at",
      params: [postId, service, ...POSTS_COLUMNS.map((name) => values[name])],
    },
  ];
  // S7b: the service row. A run row starts at summary_version 0 and never takes summary columns or
  // badges from Supabase; the conflict update leaves them as they are (design 4.4).
  const serviceNames = spec.serviceCols.map((c) => c.d);
  const insertNames = ["service", "post_id", ...serviceNames, ...(spec.heavy ? ["summary_version"] : [])];
  const insertValues = [
    `'${service}'`,
    "?1",
    ...serviceNames.map((_, i) => `?${i + 2}`),
    ...(spec.heavy ? ["0"] : []),
  ];
  statements.push({
    sql:
      `INSERT INTO ${spec.serviceTable} (${insertNames.map(q).join(", ")}) VALUES (${insertValues.join(", ")}) ` +
      `ON CONFLICT (service, post_id) DO UPDATE SET ${serviceNames.map((name) => `${q(name)} = excluded.${q(name)}`).join(", ")}`,
    params: [postId, ...spec.serviceCols.map((c) => toD1Value(c, image[c.s]))],
  });
  if (spec.child) statements.push(...childStatements(spec, postId, childElements(spec, image[spec.child.s])));
  if (spec.heavy) {
    if (spec.heavy in image) {
      // The first copy carries the raw: store it with the row.
      statements.push({
        sql:
          "INSERT INTO post_history_course_file (service, post_id, raw) VALUES ('history_course', ?1, ?2) " +
          "ON CONFLICT (service, post_id) DO UPDATE SET raw = excluded.raw",
        params: [postId, rawFile(image[spec.heavy])],
      });
    } else {
      statements.push(queueRawStatement(postId, ctx));
    }
    if (change.heavyChanged) statements.push(resetSummaryStatement(postId));
  }
  return statements;
}

function resetSummaryStatement(postId: D1Value): D1Statement {
  return {
    sql: "UPDATE post_history_course SET summary_version = 0 WHERE service = 'history_course' AND post_id = ?1",
    params: [postId],
  };
}

function mapPostUpdate(spec: PostSpec, change: MergedChange, image: RowImage, ctx: MapContext): D1Statement[] {
  const service = spec.service;
  const postId = change.rowKey.id;
  const postCols = changedCols(spec, spec.postCols, image);
  const serviceCols = changedCols(spec, spec.serviceCols, image);
  const statements: D1Statement[] = [];
  if (postCols.length > 0) {
    const set = postCols.map((c, i) => `${c.d} = ?${i + 1}`).join(", ");
    statements.push({
      sql: `UPDATE posts SET ${set} WHERE service = ?${postCols.length + 1} AND id = ?${postCols.length + 2}`,
      params: [...postCols.map((c) => toD1Value(c, image[c.s])), service, postId],
      zeroRows: "zero_rows",
    });
  }
  const heavyRaw = spec.heavy !== undefined && spec.heavy in image;
  const resetSummary = spec.heavy !== undefined && (change.heavyChanged || heavyRaw);
  if (serviceCols.length > 0 || resetSummary) {
    const sets = serviceCols.map((c, i) => `${q(c.d)} = ?${i + 1}`);
    if (resetSummary) sets.push("summary_version = 0");
    statements.push({
      sql:
        `UPDATE ${spec.serviceTable} SET ${sets.join(", ")} ` +
        `WHERE service = '${service}' AND post_id = ?${serviceCols.length + 1}`,
      params: [...serviceCols.map((c) => toD1Value(c, image[c.s])), postId],
      zeroRows: "zero_rows",
    });
  }
  if (spec.child && spec.child.s in image) {
    statements.push(...childStatements(spec, postId, childElements(spec, image[spec.child.s])));
  }
  if (spec.summary.inputs.some((name) => name in image)) {
    statements.push({
      sql:
        `UPDATE posts SET summary = (SELECT substr(trim(${spec.summary.sql}), 1, 120) FROM ${spec.serviceTable} s ` +
        "WHERE s.service = posts.service AND s.post_id = posts.id) " +
        `WHERE service = ?1 AND id = ?2 AND EXISTS (SELECT 1 FROM ${spec.serviceTable} s WHERE s.service = ?1 AND s.post_id = ?2)`,
      params: [service, postId],
    });
  }
  if (heavyRaw) {
    // A U that carries the raw (no trigger argument): store it like S13c.
    statements.push({
      sql:
        "INSERT INTO post_history_course_file (service, post_id, raw) SELECT 'history_course', ?1, ?2 " +
        "WHERE EXISTS (SELECT 1 FROM post_history_course WHERE service = 'history_course' AND post_id = ?1) " +
        "ON CONFLICT (service, post_id) DO UPDATE SET raw = excluded.raw",
      params: [postId, rawFile(image[spec.heavy!])],
    });
  } else if (change.heavyChanged) {
    statements.push(queueRawStatement(postId, ctx));
  }
  return statements;
}

// ------------------------------------------------------------------------------------------- derived and bookkeeping

/** Union of touched sets, each key once. */
export function mergeTouched(list: readonly Touched[]): Touched {
  return dedupeTouched({
    threadComments: list.flatMap((t) => t.threadComments),
    threadLikes: list.flatMap((t) => t.threadLikes),
    commentLikes: list.flatMap((t) => t.commentLikes),
  });
}

/** Recounts after a batch's mapper statements: E13a, E13b per thread key, E14 per comment id (queries.sql). */
export function recountStatements(touched: Touched, nowMs: number): D1Statement[] {
  const out: D1Statement[] = [];
  for (const key of touched.threadComments) {
    out.push({
      sql:
        "INSERT INTO threads (thread_key, comment_count, last_comment_at, updated_at) " +
        "SELECT ?1, count(*), max(created_at), ?2 FROM comments WHERE story_id = ?1 " +
        "ON CONFLICT (thread_key) DO UPDATE SET comment_count = excluded.comment_count, " +
        "last_comment_at = excluded.last_comment_at, updated_at = excluded.updated_at " +
        "WHERE threads.comment_count IS NOT excluded.comment_count OR threads.last_comment_at IS NOT excluded.last_comment_at " +
        "RETURNING comment_count",
      params: [key, nowMs],
    });
  }
  for (const key of touched.threadLikes) {
    out.push({
      sql:
        "INSERT INTO threads (thread_key, like_count, updated_at) SELECT ?1, count(*), ?2 FROM likes WHERE story_id = ?1 " +
        "ON CONFLICT (thread_key) DO UPDATE SET like_count = excluded.like_count, updated_at = excluded.updated_at " +
        "WHERE threads.like_count IS NOT excluded.like_count RETURNING like_count",
      params: [key, nowMs],
    });
  }
  for (const id of touched.commentLikes) {
    out.push({
      sql: "UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes WHERE comment_id = ?1) WHERE id = ?1 RETURNING like_count",
      params: [id],
    });
  }
  return out;
}

/** S4c: record a reject (one open reject per key). payload is the logged image, for diagnosis only. */
export function rejectStatement(
  reject: MapReject,
  opts: { direction?: "in" | "out"; ref: number; op: string; payload: unknown; nowMs: number },
): D1Statement {
  return {
    sql:
      "INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10) " +
      "ON CONFLICT (direction, table_name, row_key) WHERE resolved_at IS NULL DO UPDATE SET " +
      "op = excluded.op, reason = excluded.reason, payload = excluded.payload, error = excluded.error, " +
      "last_at = excluded.last_at, attempts = sync_rejects.attempts + 1",
    params: [
      opts.direction ?? "in",
      opts.ref,
      reject.table,
      reject.d1Table,
      JSON.stringify(reject.rowKey ?? {}),
      opts.op,
      reject.reason,
      JSON.stringify(opts.payload ?? {}),
      reject.error,
      opts.nowMs,
    ],
  };
}

/** The summary columns the fill job writes (design 4.4); built by src/lib/run-list-summary.ts. */
export interface RunSummaryColumns {
  characters: string[];
  game_mode: string;
  game_elements: unknown[];
  list_facts: object;
  badges: unknown[];
  summary_version: number;
}

/** RF2: one run's summary and badges; never touches cover_spec. */
export function runSummaryFillStatement(runId: string, summary: RunSummaryColumns): D1Statement {
  return {
    sql:
      "UPDATE post_history_course SET characters = ?2, game_mode = ?3, game_elements = ?4, list_facts = ?5, badges = ?6, " +
      "summary_version = ?7 WHERE service = 'history_course' AND post_id = ?1 AND summary_version < ?7",
    params: [
      runId,
      JSON.stringify(summary.characters),
      summary.game_mode,
      JSON.stringify(summary.game_elements),
      JSON.stringify(summary.list_facts),
      JSON.stringify(summary.badges),
      summary.summary_version,
    ],
  };
}

// ------------------------------------------------------------------------------------------- re-reads

/** True when the Supabase table has an env column (the sync filters its re-reads by it). */
export function tableHasEnv(table: string): boolean {
  return specOf(table).drop.includes("env");
}

/**
 * The Supabase columns a whole-row re-read selects (design 5.3 item 1): every mapped column, the
 * child array, and env when the table has one. Never the heavy column (runs.raw): the sync queues it.
 */
export function supabaseRowColumns(table: string): string[] {
  const spec = specOf(table);
  const names = allCols(spec).map((c) => c.s);
  if (spec.kind === "post" && spec.child) names.push(spec.child.s);
  if (tableHasEnv(table)) names.push("env");
  return [...new Set(names)];
}

/** The Supabase match (column -> value) of a D1 row key of this table, e.g. a sync_rejects.row_key. */
export function supabaseKeyOf(table: string, rowKey: Record<string, D1Value>): Record<string, D1Value> {
  const spec = specOf(table);
  if (spec.kind === "post") return { id: rowKey.id ?? null };
  const out: Record<string, D1Value> = {};
  for (const part of spec.key as KeyPart[]) {
    if (isConst(part)) continue;
    out[part.s] = rowKey[part.d] ?? null;
  }
  return out;
}

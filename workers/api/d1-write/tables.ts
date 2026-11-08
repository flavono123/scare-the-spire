import { postgrestTs } from "../../../src/lib/d1-time";
import type { D1Value } from "./db";

/**
 * D1 state -> Supabase rows (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.5): for every Supabase table
 * the step 5 mirror writes, how to read the current D1 row by its Supabase key and which columns to
 * send. Rows are assembled as JSON text without parsing the stored JSON documents (CPU budget): a
 * D1 JSON column is already compact JSON text and is spliced in as is.
 *
 * Only source columns are sent. Derived columns (post counts, vote counts, play_count, threads,
 * comments.like_count, resource_reaction_counts) are left to Supabase's own triggers, which would
 * count twice otherwise (design 5.5). `derived` lists them for the write responses only.
 */

export type ColKind = "text" | "ts" | "bool" | "int" | "json";

/** `s` = Supabase column; the read SQL aliases every column to its Supabase name. */
export type Col = { s: string; kind: ColKind };

export type MirrorTable = {
  table: string;
  /** Supabase rows carry env (all but the env-less tables, design 4.5). */
  hasEnv: boolean;
  /** Supabase unique key used as on_conflict (env included where the key has it). */
  conflict: string[];
  /** Match key columns (Supabase names, no env), in the order the read SQL binds them. */
  key: string[];
  /** One D1 row by key, columns aliased to Supabase names. */
  readSql: string;
  cols: Col[];
  /** Derived columns, read by readSql too, for write responses only (never mirrored). */
  derived?: Col[];
  /** Mirror only from the production Worker (env-less tables, design 5.5). */
  productionOnly?: boolean;
};

const c = (s: string, kind: ColKind = "text"): Col => ({ s, kind });

const AUTHOR = [c("avatar_id"), c("avatar_kind"), c("palette_id"), c("palette_swapped", "bool")];
const POST_HEAD = [c("id"), c("user_id"), c("nickname"), ...AUTHOR, c("created_at", "ts")];
const POST_COUNTS = [c("like_count", "int"), c("comment_count", "int")];

const POST_SELECT_HEAD =
  "p.id AS id, p.user_id AS user_id, p.nickname AS nickname, p.avatar_id AS avatar_id, p.avatar_kind AS avatar_kind, " +
  "p.palette_id AS palette_id, p.palette_swapped AS palette_swapped, p.created_at AS created_at, " +
  "p.like_count AS like_count, p.comment_count AS comment_count";

function postRead(service: string, serviceSelect: string, extra = ""): string {
  return (
    `SELECT ${POST_SELECT_HEAD}, ${serviceSelect}${extra} FROM posts p ` +
    `CROSS JOIN post_${service} s ON s.service = p.service AND s.post_id = p.id ` +
    `WHERE p.service = '${service}' AND p.id = ?1`
  );
}

function childArray(table: string, service: string): string {
  return (
    `(SELECT json_group_array(json_object('type', o.resource_type, 'id', o.resource_id)) FROM ` +
    `(SELECT resource_type, resource_id FROM ${table} WHERE service = '${service}' AND post_id = p.id ORDER BY ord) o)`
  );
}

export const POST_TABLES = {
  chemical_x: "chemical_posts",
  combo: "combo_posts",
  transfigure: "transfigure_posts",
  this_or_that: "this_or_that_posts",
  favorite_tournament: "favorite_tournament_posts",
  decisions_decisions: "decisions_decisions_posts",
  pagestorm: "pagestorm_posts",
} as const;

export type PostService = keyof typeof POST_TABLES;

export const MIRROR_TABLES: Record<string, MirrorTable> = {
  comments: {
    table: "comments",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql:
      "SELECT id, story_id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, content, content_blocks, " +
      "created_at, like_count FROM comments WHERE id = ?1",
    cols: [c("id"), c("story_id"), c("user_id"), c("nickname"), ...AUTHOR, c("content"), c("content_blocks", "json"), c("created_at", "ts")],
  },
  comment_likes: {
    table: "comment_likes",
    hasEnv: false,
    conflict: ["comment_id", "user_id"],
    key: ["comment_id", "user_id"],
    readSql: "SELECT comment_id, user_id, created_at FROM comment_likes WHERE comment_id = ?1 AND user_id = ?2",
    cols: [c("comment_id"), c("user_id"), c("created_at", "ts")],
  },
  likes: {
    table: "likes",
    hasEnv: true,
    conflict: ["story_id", "user_id", "env"],
    key: ["story_id", "user_id"],
    readSql: "SELECT story_id, user_id, created_at FROM likes WHERE story_id = ?1 AND user_id = ?2",
    cols: [c("story_id"), c("user_id"), c("created_at", "ts")],
  },
  resource_reactions: {
    table: "resource_reactions",
    hasEnv: true,
    conflict: ["env", "resource_type", "resource_id", "game_version", "user_id"],
    key: ["resource_id", "resource_type", "game_version", "user_id"],
    readSql:
      "SELECT resource_type, resource_id, game_version, user_id, kind FROM resource_reactions " +
      "WHERE resource_id = ?1 AND resource_type = ?2 AND game_version = ?3 AND user_id = ?4",
    cols: [c("resource_type"), c("resource_id"), c("game_version"), c("user_id"), c("kind")],
  },
  community_stories: {
    table: "community_stories",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql:
      "SELECT id, user_id, static_story_id, nickname, sentence, game, entity_type, entity_id, change_id, patch_line_id, source, " +
      "tags, linked_entities, created_at, avatar_id, avatar_kind, palette_id, palette_swapped FROM community_stories WHERE id = ?1",
    cols: [
      c("id"), c("user_id"), c("static_story_id"), c("nickname"), c("sentence"), c("game"), c("entity_type"), c("entity_id"),
      c("change_id"), c("patch_line_id"), c("source"), c("tags", "json"), c("linked_entities", "json"), c("created_at", "ts"),
      ...AUTHOR,
    ],
  },
  chemical_posts: {
    table: "chemical_posts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: postRead("chemical_x", "s.content AS content, s.content_text AS content_text"),
    cols: [...POST_HEAD, c("content", "json"), c("content_text")],
    derived: POST_COUNTS,
  },
  combo_posts: {
    table: "combo_posts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: postRead(
      "combo",
      "s.content AS content, s.content_text AS content_text",
      `, ${childArray("post_combo_resources", "combo")} AS resources`,
    ),
    cols: [...POST_HEAD, c("content", "json"), c("content_text"), c("resources", "json")],
    derived: POST_COUNTS,
  },
  transfigure_posts: {
    table: "transfigure_posts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: postRead(
      "transfigure",
      "p.title AS title, s.resource_type AS resource_type, s.resource_id AS resource_id, s.source_text AS source_text, " +
        "s.content AS content, s.content_text AS content_text, s.transformed_name AS transformed_name, " +
        "s.transformed_cost AS transformed_cost, s.transformed_star_cost AS transformed_star_cost, " +
        "s.upgraded_content AS upgraded_content, s.upgraded_content_text AS upgraded_content_text, " +
        "s.transformed_upgrade_cost AS transformed_upgrade_cost, s.transformed_upgrade_star_cost AS transformed_upgrade_star_cost, " +
        "s.show_upgrade AS show_upgrade, s.omit_energy_cost AS omit_energy_cost, s.card_top_keywords AS card_top_keywords, " +
        "s.card_bottom_keywords AS card_bottom_keywords, s.upgraded_card_top_keywords AS upgraded_card_top_keywords, " +
        "s.upgraded_card_bottom_keywords AS upgraded_card_bottom_keywords, s.transformed_card_type AS transformed_card_type, " +
        "s.transformed_card_rarity AS transformed_card_rarity, s.transformed_card_color AS transformed_card_color, " +
        "s.token_color AS token_color, s.token_wax AS token_wax, s.extra_variants AS extra_variants",
    ),
    cols: [
      ...POST_HEAD, c("title"), c("resource_type"), c("resource_id"), c("source_text"), c("content", "json"), c("content_text"),
      c("transformed_name"), c("transformed_cost"), c("transformed_star_cost"), c("upgraded_content", "json"),
      c("upgraded_content_text"), c("transformed_upgrade_cost"), c("transformed_upgrade_star_cost"), c("show_upgrade", "bool"),
      c("omit_energy_cost", "bool"), c("card_top_keywords", "json"), c("card_bottom_keywords", "json"),
      c("upgraded_card_top_keywords", "json"), c("upgraded_card_bottom_keywords", "json"), c("transformed_card_type"),
      c("transformed_card_rarity"), c("transformed_card_color"), c("token_color"), c("token_wax"), c("extra_variants", "json"),
    ],
    derived: POST_COUNTS,
  },
  this_or_that_posts: {
    table: "this_or_that_posts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: postRead(
      "this_or_that",
      "s.left_type AS left_type, s.left_id AS left_id, s.right_type AS right_type, s.right_id AS right_id, s.reason AS reason, " +
        "s.left_vote_count AS left_vote_count, s.right_vote_count AS right_vote_count",
    ),
    cols: [...POST_HEAD, c("left_type"), c("left_id"), c("right_type"), c("right_id"), c("reason")],
    derived: [...POST_COUNTS, c("left_vote_count", "int"), c("right_vote_count", "int")],
  },
  favorite_tournament_posts: {
    table: "favorite_tournament_posts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: postRead(
      "favorite_tournament",
      "p.title AS title, s.note AS note, s.preset_key AS preset_key, s.play_count AS play_count",
      `, ${childArray("post_favorite_tournament_pool", "favorite_tournament")} AS pool`,
    ),
    cols: [...POST_HEAD, c("title"), c("note"), c("preset_key"), c("pool", "json")],
    derived: [...POST_COUNTS, c("play_count", "int")],
  },
  decisions_decisions_posts: {
    table: "decisions_decisions_posts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: postRead(
      "decisions_decisions",
      "p.title AS title, s.note AS note, s.preset_key AS preset_key, s.game_version AS game_version, s.\"rows\" AS \"rows\", " +
        "s.placements AS placements, s.extra_ids AS extra_ids",
    ),
    cols: [
      ...POST_HEAD, c("title"), c("note"), c("preset_key"), c("game_version"), c("rows", "json"), c("placements", "json"),
      c("extra_ids", "json"),
    ],
    derived: POST_COUNTS,
  },
  pagestorm_posts: {
    table: "pagestorm_posts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: postRead("pagestorm", "p.title AS title, s.content AS content, s.content_text AS content_text"),
    cols: [...POST_HEAD, c("title"), c("content", "json"), c("content_text")],
    derived: POST_COUNTS,
  },
  this_or_that_post_votes: {
    table: "this_or_that_post_votes",
    hasEnv: true,
    conflict: ["post_id", "user_id", "env"],
    key: ["post_id", "user_id"],
    readSql:
      "SELECT post_id, user_id, choice, created_at FROM this_or_that_post_votes " +
      "WHERE service = 'this_or_that' AND post_id = ?1 AND user_id = ?2",
    cols: [c("post_id"), c("user_id"), c("choice"), c("created_at", "ts")],
  },
  this_or_that_post_likes: {
    table: "this_or_that_post_likes",
    hasEnv: true,
    conflict: ["post_id", "user_id", "env"],
    key: ["post_id", "user_id"],
    readSql:
      "SELECT post_id, user_id, created_at FROM this_or_that_post_likes " +
      "WHERE service = 'this_or_that' AND post_id = ?1 AND user_id = ?2",
    cols: [c("post_id"), c("user_id"), c("created_at", "ts")],
  },
  pagestorm_drafts: {
    table: "pagestorm_drafts",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql:
      "SELECT id, user_id, nickname, title, content, content_text, created_at, updated_at, avatar_id, avatar_kind, palette_id, " +
      "palette_swapped FROM pagestorm_drafts WHERE id = ?1",
    cols: [
      c("id"), c("user_id"), c("nickname"), c("title"), c("content", "json"), c("content_text"), c("created_at", "ts"),
      c("updated_at", "ts"), ...AUTHOR,
    ],
  },
  defragment_bodies: {
    table: "defragment_bodies",
    hasEnv: true,
    conflict: ["env", "source_service", "source_id"],
    key: ["source_service", "source_id"],
    readSql:
      "SELECT service AS source_service, post_id AS source_id, user_id, nickname, content, content_text, created_at, updated_at " +
      "FROM defragment_bodies WHERE service = ?1 AND post_id = ?2",
    cols: [
      c("source_service"), c("source_id"), c("user_id"), c("nickname"), c("content", "json"), c("content_text"),
      c("created_at", "ts"), c("updated_at", "ts"),
    ],
  },
  contact_inquiries: {
    table: "contact_inquiries",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql:
      "SELECT id, user_id, category, message, reply_email, page_path, service_locale, game_locale, status, created_at, " +
      "admin_response, responded_at, reply_seen_at FROM contact_inquiries WHERE id = ?1",
    cols: [
      c("id"), c("user_id"), c("category"), c("message"), c("reply_email"), c("page_path"), c("service_locale"),
      c("game_locale"), c("status"), c("created_at", "ts"), c("admin_response"), c("responded_at", "ts"),
      c("reply_seen_at", "ts"),
    ],
  },
  puzzlebox_runs: {
    table: "puzzlebox_runs",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql: "SELECT id, game, board, user_id, attempt, score, perfect, run, created_at FROM puzzlebox_runs WHERE id = ?1",
    cols: [
      c("id", "int"), c("game"), c("board"), c("user_id"), c("attempt", "int"), c("score", "int"), c("perfect", "bool"),
      c("run", "json"), c("created_at", "ts"),
    ],
  },
  puzzlebox_players: {
    table: "puzzlebox_players",
    hasEnv: false,
    conflict: ["user_id"],
    key: ["user_id"],
    // hidden is the operator's switch, written to every store by the admin script: never mirrored.
    readSql:
      "SELECT user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, updated_at FROM puzzlebox_players WHERE user_id = ?1",
    cols: [c("user_id"), c("nickname"), c("avatar_id"), c("avatar_kind"), c("palette_id"), c("palette_swapped", "bool"), c("updated_at", "ts")],
    productionOnly: true,
  },
  puzzlebox_best: {
    table: "puzzlebox_best",
    hasEnv: true,
    conflict: ["env", "game", "board", "user_id"],
    key: ["game", "board", "user_id"],
    readSql:
      "SELECT game, board, user_id, score, perfect, run_id, achieved_at, attempts FROM puzzlebox_best " +
      "WHERE game = ?1 AND board = ?2 AND user_id = ?3",
    cols: [
      c("game"), c("board"), c("user_id"), c("score", "int"), c("perfect", "bool"), c("run_id", "int"), c("achieved_at", "ts"),
      c("attempts", "int"),
    ],
  },
  puzzlebox_board_stats: {
    table: "puzzlebox_board_stats",
    hasEnv: true,
    conflict: ["env", "game", "board"],
    key: ["game", "board"],
    readSql:
      "SELECT game, board, players, cleared, perfect, score_sum, mistakes_sum, rocks_sum, purple_first, level_solved, " +
      "question_wrong, wrong_picks, speed_sum FROM puzzlebox_board_stats WHERE game = ?1 AND board = ?2",
    cols: [
      c("game"), c("board"), c("players", "int"), c("cleared", "int"), c("perfect", "int"), c("score_sum", "int"),
      c("mistakes_sum", "int"), c("rocks_sum", "int"), c("purple_first", "int"), c("level_solved", "json"),
      c("question_wrong", "json"), c("wrong_picks", "json"), c("speed_sum", "int"),
    ],
  },
  runs: {
    table: "runs",
    hasEnv: true,
    conflict: ["id", "env"],
    key: ["id"],
    // S14, without the owner columns' D1 names.
    readSql:
      "SELECT p.id AS id, p.user_id AS donor_user_id, p.nickname AS donor_nickname, p.created_at AS created_at, h.seed AS seed, " +
      "h.build AS build, h.\"character\" AS \"character\", h.ascension AS ascension, h.win AS win, h.start_time AS start_time, " +
      "h.run_time AS run_time, h.acts_count AS acts_count, h.total_floors AS total_floors, h.cover_spec AS cover_spec, " +
      "h.badges AS badges, p.like_count AS like_count, p.comment_count AS comment_count, f.raw AS raw " +
      "FROM posts p JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id " +
      "LEFT JOIN post_history_course_file f ON f.service = p.service AND f.post_id = p.id " +
      "WHERE p.service = 'history_course' AND p.id = ?1",
    cols: [
      c("id"), c("donor_user_id"), c("donor_nickname"), c("created_at", "ts"), c("seed"), c("build"), c("character"),
      c("ascension", "int"), c("win", "bool"), c("start_time", "int"), c("run_time", "int"), c("acts_count", "int"),
      c("total_floors", "int"), c("cover_spec", "json"), c("badges", "json"),
    ],
    derived: POST_COUNTS,
  },
  favorite_tournament_plays: {
    table: "favorite_tournament_plays",
    hasEnv: true,
    conflict: ["id"],
    key: ["id"],
    readSql:
      "SELECT id, tournament_id, user_id, starting_size, champion_type, champion_id, matches, created_at " +
      "FROM favorite_tournament_plays WHERE id = ?1",
    cols: [
      c("id"), c("tournament_id"), c("user_id"), c("starting_size", "int"), c("champion_type"), c("champion_id"),
      c("matches", "json"), c("created_at", "ts"),
    ],
  },
  favorite_tournament_candidate_stats: {
    table: "favorite_tournament_candidate_stats",
    hasEnv: true,
    conflict: ["tournament_id", "env", "resource_type", "resource_id"],
    key: ["tournament_id"],
    // S15: every candidate row of the tournament, as state.
    readSql:
      "SELECT tournament_id, resource_type, resource_id, match_appearances, match_wins, championships, current_rank, rank_history " +
      "FROM favorite_tournament_candidate_stats WHERE service = 'favorite_tournament' AND tournament_id = ?1",
    cols: [
      c("tournament_id"), c("resource_type"), c("resource_id"), c("match_appearances", "int"), c("match_wins", "int"),
      c("championships", "int"), c("current_rank", "int"), c("rank_history", "json"),
    ],
  },
};

export function mirrorTable(table: string): MirrorTable {
  const spec = MIRROR_TABLES[table];
  if (!spec) throw new Error(`no mirror spec for ${table}`);
  return spec;
}

/** The match key object, keys in the spec's order (the outbox match_key text is compared as text). */
export function matchKey(table: string, values: Record<string, D1Value>): Record<string, D1Value> {
  const spec = mirrorTable(table);
  const out: Record<string, D1Value> = {};
  for (const name of spec.key) {
    if (!(name in values)) throw new Error(`match key of ${table} misses ${name}`);
    out[name] = values[name];
  }
  for (const [name, value] of Object.entries(values)) if (!(name in out)) out[name] = value;
  return out;
}

function encode(kind: ColKind, value: unknown, forClient: boolean): string {
  if (value === null || value === undefined) return "null";
  switch (kind) {
    case "bool":
      return Number(value) === 0 ? "false" : "true";
    case "int":
      return String(Number(value));
    case "json":
      // D1 holds compact JSON text (CHECK json_valid): spliced without a parse.
      return String(value);
    case "ts":
      return JSON.stringify(forClient ? postgrestTs(value) : value);
    default:
      return JSON.stringify(String(value));
  }
}

/**
 * One row as JSON object text. `forClient`: timestamps in PostgREST form (today's bytes, design 3.3)
 * and derived columns included; otherwise the mirror's Supabase body (source columns only).
 */
export function rowJson(
  spec: MirrorTable,
  row: Record<string, unknown>,
  opts: { env?: string | null; extra?: Record<string, unknown> | null; forClient?: boolean; only?: readonly string[] } = {},
): string {
  const parts: string[] = [];
  const cols = opts.forClient ? [...spec.cols, ...(spec.derived ?? [])] : spec.cols;
  for (const col of cols) {
    if (opts.only && !opts.only.includes(col.s)) continue;
    parts.push(`${JSON.stringify(col.s)}:${encode(col.kind, row[col.s], Boolean(opts.forClient))}`);
  }
  if (spec.hasEnv && opts.env) parts.push(`"env":${JSON.stringify(opts.env)}`);
  for (const [name, value] of Object.entries(opts.extra ?? {})) {
    if (cols.some((col) => col.s === name)) continue;
    parts.push(`${JSON.stringify(name)}:${JSON.stringify(value ?? null)}`);
  }
  return `{${parts.join(",")}}`;
}

/** The read SQL params in key order from a match key object. */
export function keyParams(spec: MirrorTable, key: Record<string, unknown>): D1Value[] {
  return spec.key.map((name) => {
    const value = key[name];
    if (typeof value === "string" || typeof value === "number") return value;
    throw new Error(`match key of ${spec.table} misses ${name}`);
  });
}

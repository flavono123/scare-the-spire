import { canonicalTs } from "../../../src/lib/d1-time";
import {
  isPostUuid,
  isToyboxFeedService,
  isToyboxFeedSort,
  parsePostIds,
  THIS_OR_THAT_SUMMARY_IDS,
  TOYBOX_PAGE_SIZE,
  type ToyboxPostService,
} from "../../../src/lib/toybox-api-rules";
import { DEFRAGMENT_RUN_COLUMNS, PAGESTORM_LIST_COLUMNS } from "../routes/toybox";
import {
  Q_T10,
  Q_T11,
  Q_T12,
  Q_T13,
  Q_T14,
  Q_T15,
  Q_T16,
  Q_T17,
  Q_T18,
  Q_T9,
} from "./queries";
import {
  AdapterInputError,
  bool,
  columnsOf,
  json,
  jsonList,
  pick,
  query,
  readAll,
  ts,
  type AdapterContext,
  type Row,
} from "./rows";

/**
 * D1 adapters of the toybox-feed group (design 4.3, 6): service feeds (T1-T5 and their variants), the
 * 조각모음 board (T6, T7), one post (T8), the tournament (T9, T10), pagestorm (T11-T13), 조각모음
 * bodies (T14) and this-or-that counts and overlays (T15-T18). Answers are the PostgREST arrays and
 * `{v, env, rows}` bodies the step-1 routes return.
 */

/** API service -> D1 service table (posts.service = the API service id). */
export type FeedService = "combo" | "transfigure" | "this_or_that" | "chemical_x" | "decisions_decisions" | "favorite_tournament" | "pagestorm";

const AUTHOR = ["avatar_id", "avatar_kind", "palette_id", "palette_swapped"];

/**
 * Every Supabase column of each post table in table order (`select=*`, `to_jsonb(p.*)`), without the
 * dead columns design 6 rule 3 drops from the Supabase side before comparing.
 */
export const SUPABASE_POST_COLUMNS: Readonly<Record<FeedService, readonly string[]>> = {
  chemical_x: ["id", "user_id", "nickname", "content", "content_text", "env", "created_at", "like_count", "comment_count", ...AUTHOR],
  combo: ["id", "user_id", "nickname", "content", "content_text", "resources", "env", "created_at", "like_count", "comment_count", ...AUTHOR],
  transfigure: [
    "id", "user_id", "nickname", "resource_type", "resource_id", "source_text", "content", "content_text", "env", "created_at",
    "title", "transformed_name", "transformed_cost", "upgraded_content", "upgraded_content_text", "transformed_upgrade_cost",
    "show_upgrade", "card_top_keywords", "card_bottom_keywords", "upgraded_card_top_keywords", "upgraded_card_bottom_keywords",
    "transformed_card_type", "transformed_card_rarity", "transformed_star_cost", "transformed_upgrade_star_cost", "token_color",
    "token_wax", "like_count", "comment_count", "transformed_card_color", "omit_energy_cost", ...AUTHOR, "extra_variants",
  ],
  this_or_that: [
    "id", "user_id", "nickname", "left_type", "left_id", "right_type", "right_id", "reason", "env", "created_at", "like_count",
    "comment_count", "left_vote_count", "right_vote_count", "vote_rate_bps", ...AUTHOR,
  ],
  favorite_tournament: [
    "id", "user_id", "nickname", "title", "note", "preset_key", "pool", "env", "like_count", "comment_count", "play_count",
    "created_at", ...AUTHOR,
  ],
  decisions_decisions: [
    "id", "user_id", "nickname", "title", "note", "preset_key", "game_version", "rows", "placements", "extra_ids", "env",
    "like_count", "comment_count", "created_at", ...AUTHOR,
  ],
  pagestorm: ["id", "user_id", "nickname", "title", "content", "content_text", "env", "like_count", "comment_count", "created_at", ...AUTHOR],
};

/** Supabase columns no reader uses (design 6 rule 3, design 7): removed from the Supabase answer. */
export const DEAD_POST_COLUMNS: Readonly<Partial<Record<FeedService, readonly string[]>>> = {
  transfigure: ["source_game_locale"],
  favorite_tournament: ["game_version"],
};

const JSON_COLUMNS = new Set([
  "content", "resources", "upgraded_content", "card_top_keywords", "card_bottom_keywords", "upgraded_card_top_keywords",
  "upgraded_card_bottom_keywords", "extra_variants", "pool", "rows", "placements", "extra_ids",
]);
const BOOL_COLUMNS = new Set(["palette_swapped", "show_upgrade", "omit_energy_cost"]);

/** Same integer division as the generated column this_or_that_posts.vote_rate_bps. */
export function voteRateBps(left: number, right: number): number {
  const total = left + right;
  return total <= 0 ? 0 : Math.trunc((Math.max(left, right) * 10000) / total);
}

/** A D1 post row (posts + post_<service> columns, children as JSON text) as the Supabase row. */
export function postObject(service: FeedService, row: Row, dataEnv: string): Row {
  const out: Row = {};
  for (const name of SUPABASE_POST_COLUMNS[service]) {
    if (name === "env") out.env = dataEnv;
    else if (name === "created_at") out.created_at = ts(row.created_at);
    else if (name === "vote_rate_bps") out.vote_rate_bps = voteRateBps(Number(row.left_vote_count), Number(row.right_vote_count));
    else if (BOOL_COLUMNS.has(name)) out[name] = bool(row[name]);
    else if (JSON_COLUMNS.has(name)) out[name] = json(row[name]);
    else out[name] = row[name] ?? null;
  }
  return out;
}

// --- Feed SQL (T1-T5 templates) -------------------------------------------------------------

const FEED_BASE =
  "p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname, " +
  "p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped";

/** The service-table columns each feed selects, by alias s (T1-T3 shape). */
const FEED_SERVICE_COLUMNS: Readonly<Record<FeedService, string>> = {
  chemical_x: "s.content, s.content_text",
  combo: "s.content, s.content_text",
  transfigure:
    "p.title, s.resource_type, s.resource_id, s.source_text, s.content, s.content_text, s.transformed_name, s.transformed_cost, " +
    "s.transformed_star_cost, s.upgraded_content, s.upgraded_content_text, s.transformed_upgrade_cost, " +
    "s.transformed_upgrade_star_cost, s.show_upgrade, s.omit_energy_cost, s.card_top_keywords, s.card_bottom_keywords, " +
    "s.upgraded_card_top_keywords, s.upgraded_card_bottom_keywords, s.transformed_card_type, s.transformed_card_rarity, " +
    "s.transformed_card_color, s.token_color, s.token_wax, s.extra_variants",
  this_or_that: "s.left_type, s.left_id, s.right_type, s.right_id, s.reason, s.left_vote_count, s.right_vote_count",
  favorite_tournament: "p.title, s.note, s.preset_key, s.play_count",
  decisions_decisions: 'p.title, s.note, s.preset_key, s.game_version, s."rows", s.placements, s.extra_ids',
  pagestorm: "p.title, s.content, s.content_text",
};

const RESOURCES_SUBQUERY =
  "(SELECT json_group_array(json_object('type', r.resource_type, 'id', r.resource_id)) " +
  "FROM post_combo_resources r WHERE r.service = p.service AND r.post_id = p.id) AS resources";
const POOL_SUBQUERY =
  "(SELECT json_group_array(json_object('type', o.resource_type, 'id', o.resource_id)) " +
  "FROM post_favorite_tournament_pool o WHERE o.service = p.service AND o.post_id = p.id) AS pool";

function childSubquery(service: FeedService): string {
  if (service === "combo") return `, ${RESOURCES_SUBQUERY}`;
  if (service === "favorite_tournament") return `, ${POOL_SUBQUERY}`;
  return "";
}

const SCORE_COLUMN = { recommended: "p.like_count", comments: "p.comment_count" } as const;
const VOTE_TOTAL = "t.left_vote_count + t.right_vote_count";
const VOTE_LOW = `1000000000 - (${VOTE_TOTAL})`;

export type FeedSort = "latest" | "recommended" | "comments" | "vote_rate_high" | "vote_rate_low" | "play_count";

/**
 * The feed statement of one service, sort and page. Parameters: latest (?1 created_at, ?2 id);
 * the others (?1 score, ?2 created_at, ?3 id). vote_rate_* always carries the cursor tuple (T4);
 * its first page binds a sentinel above every row. null: the RPC answers nothing for the pair.
 */
export function feedSql(service: FeedService, sort: FeedSort, cursor: boolean): string | null {
  if (sort === "vote_rate_high" || sort === "vote_rate_low") {
    if (service !== "this_or_that") return null;
    const score = sort === "vote_rate_high" ? VOTE_TOTAL : VOTE_LOW;
    return (
      `SELECT ${FEED_BASE}, t.left_type, t.left_id, t.right_type, t.right_id, t.reason, t.left_vote_count, t.right_vote_count ` +
      "FROM posts p JOIN post_this_or_that t ON t.service = p.service AND t.post_id = p.id " +
      `WHERE p.service = 'this_or_that' AND ${VOTE_TOTAL} > 0 AND (${score}, p.created_at, p.id) < (?1, ?2, ?3) ` +
      `ORDER BY ${score} DESC, p.created_at DESC, p.id DESC LIMIT ${TOYBOX_PAGE_SIZE}`
    );
  }
  if (sort === "play_count") {
    if (service !== "favorite_tournament") return null;
    return (
      "SELECT q.*, (SELECT json_group_array(json_object('type', o.resource_type, 'id', o.resource_id)) " +
      "FROM post_favorite_tournament_pool o WHERE o.service = 'favorite_tournament' AND o.post_id = q.id) AS pool " +
      `FROM (SELECT ${FEED_BASE}, p.title, f.note, f.preset_key, f.play_count ` +
      "FROM posts p JOIN post_favorite_tournament f ON f.service = p.service AND f.post_id = p.id " +
      `WHERE p.service = 'favorite_tournament'${cursor ? " AND (f.play_count, p.created_at, p.id) < (?1, ?2, ?3)" : ""} ` +
      `ORDER BY f.play_count DESC, p.created_at DESC, p.id DESC LIMIT ${TOYBOX_PAGE_SIZE}) q ` +
      "ORDER BY q.play_count DESC, q.created_at DESC, q.id DESC"
    );
  }
  const scoreColumn = sort === "latest" ? null : SCORE_COLUMN[sort];
  const where = !cursor
    ? ""
    : scoreColumn
      ? ` AND (${scoreColumn}, p.created_at, p.id) < (?1, ?2, ?3)`
      : " AND (p.created_at, p.id) < (?1, ?2)";
  const order = scoreColumn ? `${scoreColumn} DESC, p.created_at DESC, p.id DESC` : "p.created_at DESC, p.id DESC";
  return (
    `SELECT ${FEED_BASE}, ${FEED_SERVICE_COLUMNS[service]}${childSubquery(service)} ` +
    `FROM posts p CROSS JOIN post_${service} s ON s.service = p.service AND s.post_id = p.id ` +
    `WHERE p.service = '${service}'${where} ORDER BY ${order} LIMIT ${TOYBOX_PAGE_SIZE}`
  );
}

/** The 조각모음 board statement (T6a-c and the other pages). Parameters as feedSql. */
export function defragmentSql(sort: "latest" | "recommended" | "comments", cursor: boolean): string {
  const scoreColumn = sort === "latest" ? null : SCORE_COLUMN[sort];
  const where = !cursor
    ? ""
    : scoreColumn
      ? ` WHERE (${scoreColumn}, p.created_at, p.id) < (?1, ?2, ?3)`
      : " WHERE (p.created_at, p.id) < (?1, ?2)";
  const order = scoreColumn ? `${scoreColumn} DESC, p.created_at DESC, p.id DESC` : "p.created_at DESC, p.id DESC";
  return (
    "SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.service, " +
    "p.summary AS title, p.nickname, p.user_id, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, " +
    "h.cover_spec, h.win, h.ascension, h.total_floors " +
    "FROM posts p LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id" +
    `${where} ORDER BY ${order} LIMIT ${TOYBOX_PAGE_SIZE}`
  );
}

/** The 조각모음 history-course filter statement (T7 and the other pages). Parameters as feedSql. */
export function defragmentRunsSql(sort: "latest" | "recommended" | "comments", cursor: boolean): string {
  const scoreColumn = sort === "latest" ? null : SCORE_COLUMN[sort];
  const where = !cursor
    ? ""
    : scoreColumn
      ? ` AND (${scoreColumn}, p.created_at, p.id) < (?1, ?2, ?3)`
      : " AND (p.created_at, p.id) < (?1, ?2)";
  const order = scoreColumn ? `${scoreColumn} DESC, p.created_at DESC, p.id DESC` : "p.created_at DESC, p.id DESC";
  return (
    "SELECT p.id, p.created_at, p.like_count, p.comment_count, h.seed, p.user_id AS donor_user_id, " +
    "p.nickname AS donor_nickname, h.cover_spec, h.win, h.ascension, h.total_floors " +
    "FROM posts p CROSS JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id " +
    `WHERE p.service = 'history_course'${where} ORDER BY ${order} LIMIT ${TOYBOX_PAGE_SIZE}`
  );
}

/** One post of a service (T8 shape; combo and the tournament rebuild their child arrays). */
export function postSql(service: FeedService): string {
  return (
    `SELECT p.*, s.*${childSubquery(service)} FROM posts p CROSS JOIN post_${service} s ` +
    "ON s.service = p.service AND s.post_id = p.id WHERE p.service = ?2 AND p.id = ?1"
  );
}

// --- Cursors -----------------------------------------------------------------------------------

type Cursor = { score: number; createdAt: string; id: string };

/** The step-1 cursor (score, created_at, cursor_id; all or none), with created_at in the stored form. */
function readCursor(url: URL): Cursor | null {
  const score = url.searchParams.get("score");
  const createdAt = url.searchParams.get("created_at");
  const id = url.searchParams.get("cursor_id");
  if (score === null || createdAt === null || id === null) return null;
  const stored = canonicalTs(createdAt);
  if (!stored) throw new AdapterInputError("cursor created_at is not a timestamp D1 can compare");
  return { score: Number(score), createdAt: stored, id };
}

const VOTE_SENTINEL: [number, string, string] = [1_000_000_000, "9999-12-31T00:00:00.000000Z", "ffffffff-ffff-4fff-8fff-ffffffffffff"];

function cursorParams(sort: FeedSort, cursor: Cursor | null, id: string | undefined): unknown[] {
  if (sort === "vote_rate_high" || sort === "vote_rate_low") {
    return cursor ? [cursor.score, cursor.createdAt, id] : VOTE_SENTINEL;
  }
  if (!cursor) return [];
  return sort === "latest" ? [cursor.createdAt, id] : [cursor.score, cursor.createdAt, id];
}

function serviceOf(value: string): FeedService | null {
  return value in SUPABASE_POST_COLUMNS ? (value as FeedService) : null;
}

// --- Adapters ------------------------------------------------------------------------------------

function feedRow(service: FeedService, row: Row, dataEnv: string): Row {
  return {
    id: row.id,
    created_at: ts(row.created_at),
    like_count: row.like_count,
    comment_count: row.comment_count,
    recommend_score: row.recommend_score,
    post: postObject(service, row, dataEnv),
  };
}

/** read.toybox-feed: get_toybox_feed rows. */
export async function toyboxFeedAdapter(context: AdapterContext): Promise<Row[]> {
  const { url } = context;
  const serviceText = url.searchParams.get("service") ?? "";
  const sort = (url.searchParams.get("sort") ?? "") as FeedSort;
  if (!isToyboxFeedService(serviceText) || !isToyboxFeedSort(sort)) throw new AdapterInputError("service or sort");
  const service = serviceOf(serviceText) as FeedService;
  const cursor = readCursor(url);
  const sql = feedSql(service, sort, cursor !== null);
  if (!sql) return [];
  // p_cursor_id is a uuid in the RPC: the cursor id compares case-insensitively there.
  const params = cursorParams(sort, cursor, cursor?.id.toLowerCase());
  const [rows] = await readAll(context.db, [query(sql, ...params)]);
  return rows.map((row) => feedRow(service, row, context.dataEnv));
}

/** read.defragment-feed: get_defragment_feed_v2 rows (history_meta for runs). */
export async function defragmentFeedAdapter(context: AdapterContext): Promise<Row[]> {
  const sort = context.url.searchParams.get("sort") ?? "";
  if (!isToyboxFeedSort(sort)) throw new AdapterInputError("sort");
  // The RPC treats every other sort as latest.
  const key = sort === "recommended" || sort === "comments" ? sort : "latest";
  const cursor = readCursor(context.url);
  const params = cursorParams(key, cursor, cursor?.id);
  const [rows] = await readAll(context.db, [query(defragmentSql(key, cursor !== null), ...params)]);
  return rows.map((row) => {
    const run = row.service === "history_course";
    return {
      id: row.id,
      created_at: ts(row.created_at),
      like_count: row.like_count,
      comment_count: row.comment_count,
      recommend_score: row.recommend_score,
      service: row.service,
      title: row.title,
      nickname: row.nickname,
      user_id: row.user_id ?? null,
      avatar_id: run ? null : row.avatar_id ?? null,
      avatar_kind: run ? null : row.avatar_kind ?? null,
      palette_id: run ? null : row.palette_id ?? null,
      palette_swapped: run ? null : bool(row.palette_swapped),
      history_meta: run
        ? { cover_spec: json(row.cover_spec), win: bool(row.win), ascension: row.ascension, total_floors: row.total_floors }
        : null,
    };
  });
}

/** read.defragment-runs: runs rows of DEFRAGMENT_RUN_COLUMNS. */
export async function defragmentRunsAdapter(context: AdapterContext): Promise<Row[]> {
  const sort = context.url.searchParams.get("sort") ?? "";
  if (sort !== "latest" && sort !== "recommended" && sort !== "comments") throw new AdapterInputError("sort");
  const cursor = readCursor(context.url);
  const params = cursorParams(sort, cursor, cursor?.id);
  const [rows] = await readAll(context.db, [query(defragmentRunsSql(sort, cursor !== null), ...params)]);
  const columns = columnsOf(DEFRAGMENT_RUN_COLUMNS);
  return rows.map((row) => pick({
    ...row,
    created_at: ts(row.created_at),
    donor_user_id: row.donor_user_id ?? null,
    cover_spec: json(row.cover_spec),
    win: bool(row.win),
  }, columns));
}

/** read.toybox-post: `select=*` of one post (0 or 1 row). */
export async function toyboxPostAdapter(context: AdapterContext): Promise<Row[]> {
  const serviceText = context.url.searchParams.get("service") ?? "";
  const id = (context.url.searchParams.get("id") ?? "").toLowerCase();
  if (!isPostUuid(id)) throw new AdapterInputError("id");
  // defragment_posts never had a row and is not copied (design 7): answered without a query.
  if ((serviceText as ToyboxPostService) === "defragment") return [];
  const service = serviceOf(serviceText);
  if (!service) throw new AdapterInputError("service");
  const [rows] = await readAll(context.db, [query(postSql(service), id, service)]);
  return rows.map((row) => postObject(service, row, context.dataEnv));
}

/** read.favorite-tournament.presets: `select=*` of the builtin tournaments. */
export async function tournamentPresetsAdapter(context: AdapterContext): Promise<Row[]> {
  const [rows] = await readAll(context.db, [query(Q_T9)]);
  return rows.map((row) => postObject("favorite_tournament", row, context.dataEnv));
}

/** read.favorite-tournament.stats: `select=*` of one tournament's candidate stats. */
export async function tournamentStatsAdapter(context: AdapterContext): Promise<Row[]> {
  const id = (context.url.searchParams.get("id") ?? "").toLowerCase();
  if (!isPostUuid(id)) throw new AdapterInputError("id");
  const [rows] = await readAll(context.db, [query(Q_T10, id)]);
  return rows.map((row) => ({
    tournament_id: id,
    env: context.dataEnv,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    match_appearances: row.match_appearances,
    match_wins: row.match_wins,
    championships: row.championships,
    current_rank: row.current_rank ?? null,
    rank_history: json(row.rank_history),
  }));
}

function pagestormListRow(row: Row, dataEnv: string): Row {
  return pick({
    ...row,
    env: dataEnv,
    content: json(row.content),
    created_at: ts(row.created_at),
    palette_swapped: bool(row.palette_swapped),
  }, columnsOf(PAGESTORM_LIST_COLUMNS));
}

/** read.pagestorm.posts: the 50 latest posts, PAGESTORM_LIST_COLUMNS. */
export async function pagestormPostsAdapter(context: AdapterContext): Promise<Row[]> {
  const [rows] = await readAll(context.db, [query(Q_T11)]);
  return rows.map((row) => pagestormListRow(row, context.dataEnv));
}

/** pagestorm_drafts columns in table order (`select=*`). */
export const SUPABASE_DRAFT_COLUMNS = [
  "id", "user_id", "nickname", "title", "content", "content_text", "env", "created_at", "updated_at", ...AUTHOR,
] as const;

/** me.pagestorm.drafts: my 20 latest drafts, or one draft (`select=*`) with ?id=. */
export async function pagestormDraftsAdapter(context: AdapterContext): Promise<Row[]> {
  const userId = context.userId;
  if (!userId) throw new AdapterInputError("user");
  const id = context.url.searchParams.get("id");
  if (id === null) {
    const [rows] = await readAll(context.db, [query(Q_T12, userId)]);
    return rows.map((row) => pagestormListRow(row, context.dataEnv));
  }
  if (!isPostUuid(id)) throw new AdapterInputError("id");
  const [rows] = await readAll(context.db, [query(Q_T13, id.toLowerCase(), userId)]);
  return rows.map((row) => pick({
    ...row,
    env: context.dataEnv,
    content: json(row.content),
    created_at: ts(row.created_at),
    updated_at: ts(row.updated_at),
    palette_swapped: bool(row.palette_swapped),
  }, SUPABASE_DRAFT_COLUMNS));
}

/** defragment_bodies columns in table order (`select=*`). */
export const SUPABASE_BODY_COLUMNS = [
  "env", "source_service", "source_id", "user_id", "nickname", "content", "content_text", "created_at", "updated_at",
] as const;

/** read.defragment-body: `select=*` of one 조각모음 body (0 or 1 row). */
export async function defragmentBodyAdapter(context: AdapterContext): Promise<Row[]> {
  const service = context.url.searchParams.get("service") ?? "";
  const id = context.url.searchParams.get("id") ?? "";
  // source_id is a uuid column in Supabase.
  if (!isPostUuid(id)) throw new AdapterInputError("id");
  const [rows] = await readAll(context.db, [query(Q_T14, id.toLowerCase(), service)]);
  return rows.map((row) => pick({
    ...row,
    env: context.dataEnv,
    content: json(row.content),
    created_at: ts(row.created_at),
    updated_at: ts(row.updated_at),
  }, SUPABASE_BODY_COLUMNS));
}

function postIds(context: AdapterContext, max?: number): string[] {
  const ids = parsePostIds(context.url.searchParams.get("ids") ?? "", max);
  if (!ids) throw new AdapterInputError("ids");
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

function rowsBody(context: AdapterContext, rows: Row[]) {
  return { v: 1, env: context.dataEnv, rows };
}

/** read.this-or-that.like-counts: the view this_or_that_post_like_counts (rows per post, no zero rows). */
export async function thisOrThatLikeCountsAdapter(context: AdapterContext) {
  const [rows] = await readAll(context.db, [query(Q_T15, jsonList(postIds(context)))]);
  return rowsBody(context, rows.map((row) => ({ post_id: row.post_id, like_count: row.like_count })));
}

/** me.this-or-that.likes: my likes among the listed posts. */
export async function thisOrThatMyLikesAdapter(context: AdapterContext) {
  if (!context.userId) throw new AdapterInputError("user");
  const [rows] = await readAll(context.db, [query(Q_T16, context.userId, jsonList(postIds(context)))]);
  return rowsBody(context, rows.map((row) => ({ post_id: row.post_id })));
}

/** read.this-or-that.vote-summaries: get_this_or_that_vote_summaries (posts with votes only). */
export async function thisOrThatVoteSummariesAdapter(context: AdapterContext) {
  const [rows] = await readAll(context.db, [query(Q_T17, jsonList(postIds(context, THIS_OR_THAT_SUMMARY_IDS)))]);
  return rowsBody(context, rows.map((row) => ({
    post_id: row.post_id,
    left_count: row.left_count,
    right_count: row.right_count,
    total_count: row.total_count,
  })));
}

/** me.this-or-that.votes: my votes among the listed posts. */
export async function thisOrThatMyVotesAdapter(context: AdapterContext) {
  if (!context.userId) throw new AdapterInputError("user");
  const [rows] = await readAll(context.db, [query(Q_T18, context.userId, jsonList(postIds(context)))]);
  return rowsBody(context, rows.map((row) => ({ post_id: row.post_id, choice: row.choice })));
}

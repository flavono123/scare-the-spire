import { mapChange, mapRow, type MapResult, type RowImage } from "../../../../src/lib/d1-sync/row-mapper";
import {
  isPostUuid,
  isToyboxPostService,
  isToyboxUpdatable,
  THIS_OR_THAT_CHOICES,
  THIS_OR_THAT_VOTE_SURFACES,
  type ToyboxPostService,
} from "../../../../src/lib/toybox-api-rules";
import { apiError, PRIVATE_NO_STORE, API_MARKER_HEADER } from "../../http";
import { json, ownerCopyStatement, type D1WriteContext } from "../context";
import { changesOf, queryAll, rowsOf, runBatch, stmt, writeFailureCode, pgTimestampText, type D1Statement } from "../db";
import { outboxStatement, readPayload } from "../outbox";
import { mirrorTable, POST_TABLES, rowJson, type PostService } from "../tables";

/**
 * The toybox-feed group's writes on D1 (queries.sql TW*, TL*, design 4.3): posts of the seven Toy Box
 * services, this-or-that likes and votes, the favorite tournament play (complete_favorite_tournament_play
 * ported), 서류 폭풍 drafts and 조각모음 bodies.
 *
 * A post body is the Supabase row the client sends today (step 1 passes it to PostgREST unparsed).
 * The Worker parses it, keeps today's server columns (guard_post_server_columns: id may be given, counts
 * start at 0, created_at is now; an edit keeps id, env, counts and created_at), checks the owner as RLS
 * does (user_id = the caller), and turns the row into D1 statements with the shared row mapper, so a
 * write lands in D1 in the same bytes the sync would write.
 */

type Row = Record<string, unknown>;

const AUTHOR_DEFAULTS: Row = { avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false };

type PostInput = {
  table: string;
  required: string[];
  defaults: Row;
  /** Supabase-only columns D1 does not keep (design 7): carried to the mirror and the response. */
  extras: string[];
  /** Counters the guard trigger owns. */
  counters: string[];
  /** Generated columns: a value in the body is refused, as Postgres does. */
  generated: string[];
};

const POST_INPUTS: Record<PostService, PostInput> = {
  chemical_x: { table: "chemical_posts", required: ["content", "content_text"], defaults: {}, extras: [], counters: [], generated: [] },
  combo: { table: "combo_posts", required: ["content", "content_text", "resources"], defaults: {}, extras: [], counters: [], generated: [] },
  transfigure: {
    table: "transfigure_posts",
    required: ["resource_type", "resource_id", "source_text", "source_game_locale", "content", "content_text"],
    defaults: {
      title: null, transformed_name: null, transformed_cost: null, transformed_star_cost: null, upgraded_content: null,
      upgraded_content_text: null, transformed_upgrade_cost: null, transformed_upgrade_star_cost: null, show_upgrade: false,
      omit_energy_cost: false, card_top_keywords: [], card_bottom_keywords: [], upgraded_card_top_keywords: [],
      upgraded_card_bottom_keywords: [], transformed_card_type: null, transformed_card_rarity: null,
      transformed_card_color: null, token_color: null, token_wax: null, extra_variants: [],
    },
    extras: ["source_game_locale"],
    counters: [],
    generated: [],
  },
  this_or_that: {
    table: "this_or_that_posts",
    required: ["left_type", "left_id", "right_type", "right_id", "reason"],
    defaults: {},
    extras: [],
    counters: ["left_vote_count", "right_vote_count"],
    generated: ["vote_rate_bps"],
  },
  favorite_tournament: {
    table: "favorite_tournament_posts",
    required: ["title", "preset_key", "game_version", "pool"],
    defaults: { note: "" },
    extras: ["game_version"],
    counters: ["play_count"],
    generated: [],
  },
  decisions_decisions: {
    table: "decisions_decisions_posts",
    required: ["title", "preset_key", "game_version", "rows", "placements"],
    defaults: { note: "", extra_ids: [] },
    extras: [],
    counters: [],
    generated: [],
  },
  pagestorm: { table: "pagestorm_posts", required: ["title", "content", "content_text"], defaults: {}, extras: [], counters: [], generated: [] },
};

const BASE_COLUMNS = ["id", "user_id", "nickname", "avatar_id", "avatar_kind", "palette_id", "palette_swapped", "env", "created_at", "like_count", "comment_count"];

function allowedColumns(service: PostService): Set<string> {
  const input = POST_INPUTS[service];
  const spec = mirrorTable(input.table);
  return new Set([...BASE_COLUMNS, ...spec.cols.map((col) => col.s), ...input.extras, ...input.counters, ...input.generated]);
}

function isPostService(service: ToyboxPostService): service is PostService {
  return service in POST_TABLES;
}

function rowsResponse(rows: string[], env: string, status = 200): Response {
  // The step 1 answer is PostgREST's array as is; this is the same array.
  return new Response(`[${rows.join(",")}]`, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": PRIVATE_NO_STORE,
      "X-Robots-Tag": "noindex",
      "X-Slseoun-Api-Env": env,
      [API_MARKER_HEADER]: "1",
    },
  });
}

async function readBodyObject(write: D1WriteContext): Promise<Row | null> {
  const stream = write.context.bodyStream;
  let value: unknown = write.context.body;
  if (stream) {
    try {
      value = JSON.parse(await new Response(stream).text());
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

/** A mapper statement without its ON CONFLICT clause: a client-chosen id must not overwrite a row. */
function plainInsert(statement: D1Statement): D1Statement {
  if (!/^INSERT INTO \w+ \(/.test(statement.sql) || !statement.sql.includes(" ON CONFLICT ")) {
    throw new Error("not a mapper upsert");
  }
  return { sql: statement.sql.slice(0, statement.sql.indexOf(" ON CONFLICT ")), params: statement.params };
}

function mapped(result: MapResult): D1Statement[] | null {
  return result.ok ? result.statements : null;
}

function normalizeUuid(value: unknown): string | null {
  return typeof value === "string" && isPostUuid(value) ? value.toLowerCase() : null;
}

/** The row to answer with (select=*): D1 row + today's Supabase-only columns. */
function postAnswer(write: D1WriteContext, service: PostService, row: Row, extra: Row): string {
  const spec = mirrorTable(POST_INPUTS[service].table);
  const answerExtra: Row = { ...extra };
  if (service === "this_or_that") {
    const left = Number(row.left_vote_count ?? 0);
    const right = Number(row.right_vote_count ?? 0);
    answerExtra.vote_rate_bps = left + right <= 0 ? 0 : Math.trunc((Math.max(left, right) * 10000) / (left + right));
  }
  return rowJson(spec, row, { env: write.dataEnv, extra: answerExtra, forClient: true });
}

export async function createPost(write: D1WriteContext): Promise<Response> {
  const service = write.context.url.searchParams.get("service") ?? "";
  if (!isToyboxPostService(service)) return apiError("invalid");
  // defragment_posts never had a row and is not in D1 (design 7); no screen creates one.
  if (!isPostService(service)) return apiError("invalid");
  const body = await readBodyObject(write);
  if (!body) return apiError("invalid");
  const input = POST_INPUTS[service];
  const allowed = allowedColumns(service);
  if (Object.keys(body).some((name) => !allowed.has(name))) return apiError("invalid");
  if (input.generated.some((name) => name in body)) return apiError("invalid");
  if ("env" in body && body.env !== write.dataEnv) return apiError("invalid");
  // RLS: auth.uid() = user_id (and no builtin tournament from a client).
  if (body.user_id !== write.uid) return apiError("forbidden");
  if (service === "favorite_tournament" && typeof body.preset_key === "string" && body.preset_key.startsWith("builtin:")) {
    return apiError("forbidden");
  }
  if (input.required.some((name) => body[name] === undefined || body[name] === null)) return apiError("invalid");
  let id: string;
  if (body.id === undefined) {
    id = crypto.randomUUID();
  } else {
    const given = normalizeUuid(body.id);
    if (!given) return apiError("invalid");
    id = given;
  }
  const image: RowImage = { ...AUTHOR_DEFAULTS, ...input.defaults, ...body, id, user_id: write.uid, created_at: write.now, like_count: 0, comment_count: 0 };
  for (const counter of input.counters) image[counter] = 0;
  delete image.env;
  const extra: Row = Object.fromEntries(input.extras.map((name) => [name, image[name]]));
  const statements = mapped(mapRow(input.table, image, { nowMs: write.nowMs }));
  if (!statements) return apiError("invalid");
  const spec = mirrorTable(input.table);
  let results;
  try {
    results = await runBatch(write.db, [
      plainInsert(statements[0]),
      ...statements.slice(1),
      outboxStatement({ table: input.table, op: "insert", match: { id }, payload: readPayload("posts", extra) }, write.nowMs),
      stmt(spec.readSql, id),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const row = rowsOf<Row>(results[results.length - 1])[0];
  if (!row) return apiError("unavailable");
  return rowsResponse([postAnswer(write, service, row, extra)], write.dataEnv, 201);
}

export async function updatePost(write: D1WriteContext): Promise<Response> {
  const service = write.context.url.searchParams.get("service") ?? "";
  const id = normalizeUuid(write.context.url.searchParams.get("id") ?? "");
  if (!isToyboxPostService(service) || !isToyboxUpdatable(service) || !id) return apiError("invalid");
  const body = await readBodyObject(write);
  if (!body) return apiError("invalid");
  if (!isPostService(service)) return rowsResponse([], write.dataEnv);
  const input = POST_INPUTS[service];
  const allowed = allowedColumns(service);
  if (Object.keys(body).some((name) => !allowed.has(name))) return apiError("invalid");
  if (input.generated.some((name) => name in body)) return apiError("invalid");
  if ("user_id" in body && body.user_id !== write.uid) return apiError("forbidden");
  const owned = await queryAll(write.db, stmt("SELECT 1 FROM posts WHERE service = ?2 AND id = ?1 AND user_id = ?3", id, service, write.uid))
    .catch(() => null);
  if (owned === null) return apiError("unavailable");
  // RLS USING (auth.uid() = user_id): another user's post is no row, and PATCH answers [].
  if (owned.length === 0) return rowsResponse([], write.dataEnv);
  // guard_post_server_columns keeps id, env, counts and created_at on update.
  const patch: RowImage = { ...body };
  for (const name of ["id", "env", "user_id", "created_at", "like_count", "comment_count", ...input.counters]) delete patch[name];
  const extra: Row = Object.fromEntries(input.extras.filter((name) => name in patch).map((name) => [name, patch[name]]));
  const statements = mapped(mapChange(
    {
      table: input.table,
      d1Table: "posts",
      rowKey: { service, id },
      keyText: JSON.stringify({ service, id }),
      action: "update",
      image: patch,
      priorImages: [],
      heavyChanged: false,
      ids: [],
    },
    { nowMs: write.nowMs },
  ));
  if (!statements) return apiError("invalid");
  const spec = mirrorTable(input.table);
  const columns = Object.keys(patch).filter((name) => spec.cols.some((col) => col.s === name));
  const outbox = columns.length || Object.keys(extra).length
    ? [outboxStatement(
        { table: input.table, op: "update", match: { id, user_id: write.uid }, payload: { read: "posts", columns, ...(Object.keys(extra).length ? { extra } : {}) } },
        write.nowMs,
      )]
    : [];
  let results;
  try {
    results = await runBatch(write.db, [...statements, ...outbox, stmt(spec.readSql, id)]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const row = rowsOf<Row>(results[results.length - 1])[0];
  return rowsResponse(row ? [postAnswer(write, service, row, extra)] : [], write.dataEnv);
}

export async function deletePost(write: D1WriteContext): Promise<Response> {
  const service = write.context.url.searchParams.get("service") ?? "";
  const id = normalizeUuid(write.context.url.searchParams.get("id") ?? "");
  if (!isToyboxPostService(service) || !id) return apiError("invalid");
  if (!isPostService(service)) return json({ v: 1, env: write.dataEnv, deleted: false });
  let results;
  try {
    results = await runBatch(write.db, [
      // TW3: cascades the service row, children, votes, likes, plays, stats and the body.
      stmt("DELETE FROM posts WHERE service = ?2 AND id = ?1 AND user_id = ?3 RETURNING id", id, service, write.uid),
      outboxStatement({ table: POST_TABLES[service], op: "delete", match: { id, user_id: write.uid }, payload: null }, write.nowMs),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv, deleted: rowsOf(results[0]).length > 0 });
}

// --- This or that ---------------------------------------------------------------------------------

export async function thisOrThatLike(write: D1WriteContext, like: boolean): Promise<Response> {
  const id = normalizeUuid(write.context.url.searchParams.get("id") ?? "");
  if (!id) return apiError("invalid");
  const key = `this-or-that:${id}`;
  const statements = like
    ? [
        // TL1: a missing post fails the FK (today 23503 -> not_found); a repeat like is a no-op success.
        stmt("INSERT INTO this_or_that_post_likes (service, post_id, user_id, created_at) VALUES ('this_or_that', ?1, ?2, ?3) ON CONFLICT DO NOTHING", id, write.uid, write.now),
        ownerCopyStatement(key) as D1Statement,
        outboxStatement(
          { table: "this_or_that_post_likes", op: "insert", match: { post_id: id, user_id: write.uid }, payload: readPayload("this_or_that_post_likes") },
          write.nowMs,
        ),
      ]
    : [
        // TL2 and the outbox delete row: without it Supabase keeps the like (design 4.3).
        stmt("DELETE FROM this_or_that_post_likes WHERE service = 'this_or_that' AND post_id = ?1 AND user_id = ?2", id, write.uid),
        ownerCopyStatement(key) as D1Statement,
        outboxStatement({ table: "this_or_that_post_likes", op: "delete", match: { post_id: id, user_id: write.uid }, payload: null }, write.nowMs),
      ];
  try {
    await runBatch(write.db, statements);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv, liked: like });
}

const VOTE_RECOUNT =
  "UPDATE post_this_or_that SET " +
  "left_vote_count = (SELECT count(*) FROM this_or_that_post_votes WHERE service = 'this_or_that' AND post_id = ?1 AND choice = 'left'), " +
  "right_vote_count = (SELECT count(*) FROM this_or_that_post_votes WHERE service = 'this_or_that' AND post_id = ?1 AND choice = 'right') " +
  "WHERE service = 'this_or_that' AND post_id = ?1 RETURNING left_vote_count, right_vote_count";

export async function vote(write: D1WriteContext): Promise<Response> {
  const id = normalizeUuid(write.context.url.searchParams.get("id") ?? "");
  const body = write.context.body as { choice?: unknown; surface?: unknown } | null;
  if (!id || !body || typeof body !== "object") return apiError("invalid");
  if (!(THIS_OR_THAT_CHOICES as readonly unknown[]).includes(body.choice) || !(THIS_OR_THAT_VOTE_SURFACES as readonly unknown[]).includes(body.surface)) {
    return apiError("invalid");
  }
  try {
    await runBatch(write.db, [
      // TW4a: a second vote is the PK conflict (today 23505 -> duplicate).
      stmt("INSERT INTO this_or_that_post_votes (service, post_id, user_id, choice, created_at) VALUES ('this_or_that', ?1, ?2, ?3, ?4)", id, write.uid, String(body.choice), write.now),
      stmt(VOTE_RECOUNT, id),
      outboxStatement(
        {
          table: "this_or_that_post_votes",
          op: "insert",
          match: { post_id: id, user_id: write.uid },
          // created_surface is write-only (design 7) and NOT NULL in Supabase.
          payload: readPayload("this_or_that_post_votes", { created_surface: body.surface }),
        },
        write.nowMs,
      ),
    ]);
  } catch (error) {
    // The insert policy needs a post of the same env: a missing post is 42501 today, not 23503.
    return apiError(writeFailureCode(error, { fk: "forbidden" }));
  }
  return json({ v: 1, env: write.dataEnv, choice: body.choice }, 201);
}

export async function unvote(write: D1WriteContext): Promise<Response> {
  const id = normalizeUuid(write.context.url.searchParams.get("id") ?? "");
  if (!id) return apiError("invalid");
  try {
    await runBatch(write.db, [
      stmt("DELETE FROM this_or_that_post_votes WHERE service = 'this_or_that' AND post_id = ?1 AND user_id = ?2", id, write.uid),
      stmt(VOTE_RECOUNT, id),
      outboxStatement({ table: "this_or_that_post_votes", op: "delete", match: { post_id: id, user_id: write.uid }, payload: null }, write.nowMs),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv, choice: null });
}

// --- Favorite tournament play (complete_favorite_tournament_play) ------------------------------------

/** jsonb ->> text: strings as they are, other scalars as their JSON text, null for null or absent. */
function pgText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

type PlayCheck = { ok: true; deltas: Map<string, { type: string; id: string; a: number; w: number; c: number }> } | { ok: false };

/**
 * The RPC's checks and its per-candidate deltas, in its order: size, matches, the tournament, size
 * against the pool, every side in the pool, the champion winning the final, then each match's fields
 * and winner. Every failure is `raise exception` (P0001) today, which the API answers `invalid`.
 */
export function checkTournamentPlay(
  input: { startingSize: number; championType: string; championId: string; matches: unknown[] },
  pool: readonly { resource_type: string; resource_id: string }[] | null,
): PlayCheck {
  const { startingSize, matches } = input;
  if (!Number.isInteger(startingSize) || startingSize < 2) return { ok: false };
  if (matches.length !== startingSize - 1) return { ok: false };
  if (pool === null) return { ok: false };
  if (startingSize > pool.length) return { ok: false };
  const inPool = (type: string | null, id: string | null) =>
    type !== null && id !== null && pool.some((entry) => entry.resource_type === type && entry.resource_id === id);
  const field = (match: unknown, name: string) =>
    match && typeof match === "object" && !Array.isArray(match) ? pgText((match as Row)[name]) : null;
  for (const match of matches) {
    if (!inPool(field(match, "left_type"), field(match, "left_id")) || !inPool(field(match, "right_type"), field(match, "right_id"))) {
      return { ok: false };
    }
  }
  const final = matches[matches.length - 1];
  const winnerSide = field(final, "winner");
  const championType = winnerSide === null ? null : field(final, `${winnerSide}_type`);
  const championId = winnerSide === null ? null : field(final, `${winnerSide}_id`);
  if (input.championType !== championType || input.championId !== championId) return { ok: false };
  const deltas = new Map<string, { type: string; id: string; a: number; w: number; c: number }>();
  const bump = (type: string, id: string, a: number, w: number, c: number) => {
    const key = JSON.stringify([type, id]);
    const entry = deltas.get(key) ?? { type, id, a: 0, w: 0, c: 0 };
    entry.a += a;
    entry.w += w;
    entry.c += c;
    deltas.set(key, entry);
  };
  for (const match of matches) {
    const leftType = field(match, "left_type");
    const leftId = field(match, "left_id");
    const rightType = field(match, "right_type");
    const rightId = field(match, "right_id");
    const winner = field(match, "winner");
    if (leftType === null || leftId === null || rightType === null || rightId === null) return { ok: false };
    if (winner !== "left" && winner !== "right") return { ok: false };
    bump(leftType, leftId, 1, winner === "left" ? 1 : 0, 0);
    bump(rightType, rightId, 1, winner === "right" ? 1 : 0, 0);
  }
  bump(input.championType, input.championId, 0, 0, 1);
  return { ok: true, deltas };
}

export async function tournamentPlay(write: D1WriteContext): Promise<Response> {
  const body = write.context.body as Row | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("invalid");
  const { tournamentId, startingSize, championType, championId, matches } = body;
  if (typeof tournamentId !== "string" || !isPostUuid(tournamentId)) return apiError("invalid");
  if (!Number.isInteger(startingSize) || typeof championType !== "string" || typeof championId !== "string") return apiError("invalid");
  if (!Array.isArray(matches)) return apiError("invalid");
  const tournament = tournamentId.toLowerCase();
  // T22 plus the tournament's existence (a pool can be empty).
  let pool: { resource_type: string; resource_id: string }[] | null;
  try {
    const results = await runBatch(write.db, [
      stmt("SELECT 1 AS found FROM post_favorite_tournament WHERE service = 'favorite_tournament' AND post_id = ?1", tournament),
      stmt("SELECT resource_type, resource_id FROM post_favorite_tournament_pool WHERE service = 'favorite_tournament' AND post_id = ?1", tournament),
    ]);
    pool = rowsOf(results[0]).length ? rowsOf<{ resource_type: string; resource_id: string }>(results[1]) : null;
  } catch {
    return apiError("unavailable");
  }
  const checked = checkTournamentPlay({ startingSize: startingSize as number, championType, championId, matches }, pool);
  if (!checked.ok) return apiError("invalid");
  const playId = crypto.randomUUID();
  const deltas = [...checked.deltas.values()].map(({ type, id, a, w, c }) => ({ type, id, a, w, c }));
  try {
    await runBatch(write.db, [
      // TW5a
      stmt(
        "INSERT INTO favorite_tournament_plays (id, service, tournament_id, user_id, starting_size, champion_type, champion_id, matches, created_at) " +
          "VALUES (?1, 'favorite_tournament', ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        playId, tournament, write.uid, startingSize as number, championType, championId, JSON.stringify(matches), write.now,
      ),
      // TW5b
      stmt(
        "UPDATE post_favorite_tournament SET play_count = (SELECT count(*) FROM favorite_tournament_plays " +
          "WHERE service = 'favorite_tournament' AND tournament_id = ?1) WHERE service = 'favorite_tournament' AND post_id = ?1 RETURNING play_count",
        tournament,
      ),
      // TW5c
      stmt(
        "INSERT INTO favorite_tournament_candidate_stats (service, tournament_id, resource_type, resource_id, match_appearances, match_wins, championships) " +
          "SELECT 'favorite_tournament', ?1, json_extract(value, '$.type'), json_extract(value, '$.id'), json_extract(value, '$.a'), " +
          "json_extract(value, '$.w'), json_extract(value, '$.c') FROM json_each(?2) WHERE true " +
          "ON CONFLICT (service, tournament_id, resource_type, resource_id) DO UPDATE SET " +
          "match_appearances = match_appearances + excluded.match_appearances, " +
          "match_wins = match_wins + excluded.match_wins, championships = championships + excluded.championships",
        tournament, JSON.stringify(deltas),
      ),
      // TW5d
      stmt(
        "UPDATE favorite_tournament_candidate_stats AS s SET current_rank = r.rnk, " +
          "rank_history = json_insert(s.rank_history, '$[#]', json_object('at', ?2, 'rank', r.rnk)) " +
          "FROM (SELECT resource_type, resource_id, row_number() OVER (ORDER BY championships DESC, " +
          "CASE WHEN match_appearances > 0 THEN CAST(match_wins AS REAL) / match_appearances ELSE 0 END DESC, " +
          "match_appearances DESC, resource_type, resource_id) AS rnk " +
          "FROM favorite_tournament_candidate_stats r WHERE r.service = 'favorite_tournament' AND r.tournament_id = ?1) AS r " +
          "WHERE s.service = 'favorite_tournament' AND s.tournament_id = ?1 AND s.resource_type = r.resource_type " +
          "AND s.resource_id = r.resource_id AND s.current_rank IS NOT r.rnk",
        tournament, pgTimestampText(write.nowMs),
      ),
      // The play and the stats as state go through mirror_favorite_tournament_play (design 5.5).
      outboxStatement(
        { table: "favorite_tournament_plays", op: "rpc", match: { id: playId }, payload: { read: "favorite_tournament_plays", fn: "mirror_favorite_tournament_play" } },
        write.nowMs,
      ),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error, { fk: "invalid" }));
  }
  return json({ v: 1, env: write.dataEnv, result: { ok: true } });
}

// --- 서류 폭풍 drafts ------------------------------------------------------------------------------

const DRAFT_COLUMNS = new Set(["id", "user_id", "nickname", "title", "content", "content_text", "env", "created_at", "updated_at", "avatar_id", "avatar_kind", "palette_id", "palette_swapped"]);

function draftAnswer(write: D1WriteContext, row: Row): string {
  return rowJson(mirrorTable("pagestorm_drafts"), row, { env: write.dataEnv, forClient: true });
}

export async function createDraft(write: D1WriteContext): Promise<Response> {
  const body = await readBodyObject(write);
  if (!body) return apiError("invalid");
  if (Object.keys(body).some((name) => !DRAFT_COLUMNS.has(name))) return apiError("invalid");
  if ("env" in body && body.env !== write.dataEnv) return apiError("invalid");
  if (body.user_id !== write.uid) return apiError("forbidden");
  let id = crypto.randomUUID();
  if (body.id !== undefined) {
    const given = normalizeUuid(body.id);
    if (!given) return apiError("invalid");
    id = given;
  }
  // No guard trigger on drafts: created_at and updated_at are the client's when sent, else now().
  const image: RowImage = { ...AUTHOR_DEFAULTS, created_at: write.now, updated_at: write.now, ...body, id, user_id: write.uid };
  delete image.env;
  const statements = mapped(mapRow("pagestorm_drafts", image, { nowMs: write.nowMs }));
  if (!statements) return apiError("invalid");
  let results;
  try {
    results = await runBatch(write.db, [
      plainInsert(statements[0]),
      outboxStatement({ table: "pagestorm_drafts", op: "insert", match: { id }, payload: readPayload("pagestorm_drafts") }, write.nowMs),
      stmt(mirrorTable("pagestorm_drafts").readSql, id),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const row = rowsOf<Row>(results[results.length - 1])[0];
  if (!row) return apiError("unavailable");
  return rowsResponse([draftAnswer(write, row)], write.dataEnv, 201);
}

export async function updateDraft(write: D1WriteContext): Promise<Response> {
  const id = normalizeUuid(write.context.url.searchParams.get("id") ?? "");
  if (!id) return apiError("invalid");
  const body = await readBodyObject(write);
  if (!body) return apiError("invalid");
  if (Object.keys(body).some((name) => !DRAFT_COLUMNS.has(name))) return apiError("invalid");
  if ("user_id" in body && body.user_id !== write.uid) return apiError("forbidden");
  if ("env" in body && body.env !== write.dataEnv) return apiError("invalid");
  if ("id" in body && normalizeUuid(body.id) !== id) return apiError("invalid");
  const patch: RowImage = { ...body };
  for (const name of ["id", "env", "user_id"]) delete patch[name];
  const statements = mapped(mapChange(
    {
      table: "pagestorm_drafts",
      d1Table: "pagestorm_drafts",
      rowKey: { id },
      keyText: JSON.stringify({ id }),
      action: "update",
      image: patch,
      priorImages: [],
      heavyChanged: false,
      ids: [],
    },
    { nowMs: write.nowMs },
  ));
  if (!statements) return apiError("invalid");
  // RLS USING / WITH CHECK auth.uid() = user_id: the mapper's UPDATE by id, guarded by the owner.
  const guarded = statements.map((statement) => ({
    sql: `${statement.sql} AND user_id = ?${statement.params.length + 1}`,
    params: [...statement.params, write.uid],
  }));
  const columns = Object.keys(patch);
  const draft = mirrorTable("pagestorm_drafts");
  let results;
  try {
    results = await runBatch(write.db, [
      ...guarded,
      ...(columns.length
        ? [outboxStatement(
            { table: "pagestorm_drafts", op: "update", match: { id, user_id: write.uid }, payload: { read: "pagestorm_drafts", columns } },
            write.nowMs,
            { sql: "EXISTS (SELECT 1 FROM pagestorm_drafts WHERE id = ?6 AND user_id = ?7)", params: [id, write.uid] },
          )]
        : []),
      stmt(`${draft.readSql} AND user_id = ?2`, id, write.uid),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const row = rowsOf<Row>(results[results.length - 1])[0];
  return rowsResponse(row ? [draftAnswer(write, row)] : [], write.dataEnv);
}

export async function deleteDraft(write: D1WriteContext): Promise<Response> {
  const id = normalizeUuid(write.context.url.searchParams.get("id") ?? "");
  if (!id) return apiError("invalid");
  let results;
  try {
    results = await runBatch(write.db, [
      // TW7
      stmt("DELETE FROM pagestorm_drafts WHERE id = ?1 AND user_id = ?2 RETURNING id", id, write.uid),
      outboxStatement({ table: "pagestorm_drafts", op: "delete", match: { id, user_id: write.uid }, payload: null }, write.nowMs),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv, deleted: rowsOf(results[0]).length > 0 });
}

// --- 조각모음 bodies (defragment_source_owned) -------------------------------------------------------

const BODY_COLUMNS = new Set(["env", "source_service", "source_id", "user_id", "nickname", "content", "content_text", "created_at", "updated_at"]);

export async function upsertBody(write: D1WriteContext): Promise<Response> {
  const body = await readBodyObject(write);
  if (!body) return apiError("invalid");
  if (Object.keys(body).some((name) => !BODY_COLUMNS.has(name))) return apiError("invalid");
  if ("env" in body && body.env !== write.dataEnv) return apiError("invalid");
  const service = body.source_service;
  const sourceId = normalizeUuid(body.source_id);
  if (typeof service !== "string" || !sourceId) return apiError("invalid");
  if (typeof body.nickname !== "string" || typeof body.content_text !== "string" || body.content === undefined) return apiError("invalid");
  // RLS: user_id = auth.uid() and defragment_source_owned: one of the seven post services, the caller's post.
  if (body.user_id !== write.uid || !(service in POST_TABLES)) return apiError("forbidden");
  const content = JSON.stringify(body.content);
  let results;
  try {
    results = await runBatch(write.db, [
      // TW6: owner of the post only; the update keeps the row's owner.
      stmt(
        "INSERT INTO defragment_bodies (service, post_id, user_id, nickname, content, content_text, created_at, updated_at) " +
          "SELECT ?2, ?1, ?3, ?4, ?5, ?6, ?7, ?7 WHERE EXISTS (SELECT 1 FROM posts WHERE service = ?2 AND id = ?1 AND user_id = ?3) " +
          "ON CONFLICT (service, post_id) DO UPDATE SET nickname = excluded.nickname, content = excluded.content, " +
          "content_text = excluded.content_text, updated_at = excluded.updated_at WHERE defragment_bodies.user_id = excluded.user_id",
        sourceId, service, write.uid, body.nickname, content, body.content_text, write.now,
      ),
      outboxStatement(
        { table: "defragment_bodies", op: "upsert", match: { source_service: service, source_id: sourceId }, payload: readPayload("defragment_bodies") },
        write.nowMs,
        { sql: "EXISTS (SELECT 1 FROM defragment_bodies WHERE service = ?6 AND post_id = ?7 AND user_id = ?8 AND updated_at = ?9)", params: [service, sourceId, write.uid, write.now] },
      ),
      stmt(mirrorTable("defragment_bodies").readSql, service, sourceId),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  // Not the caller's post (or another user's body): RLS refuses it today (42501).
  if (changesOf(results[0]) === 0) return apiError("forbidden");
  const row = rowsOf<Row>(results[results.length - 1])[0];
  if (!row) return apiError("unavailable");
  return rowsResponse([rowJson(mirrorTable("defragment_bodies"), row, { env: write.dataEnv, forClient: true })], write.dataEnv);
}

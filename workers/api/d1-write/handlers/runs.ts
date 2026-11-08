import { isRunId } from "../../../../src/lib/history-runs-api-rules";
import { apiError, jsonResponse } from "../../http";
import { json, type D1WriteContext } from "../context";
import { rowsOf, runBatch, stmt, writeFailureCode } from "../db";
import { outboxStatement } from "../outbox";

/**
 * 역사 강의서 run writes on D1 (queries.sql R11-R14, design 4.4 "5단계 공유 요청").
 *
 * Sharing is one run per request on D1: the step 1 batch body (up to 24 MB of raw files) cannot be
 * parsed in the CPU budget, and one batch of 42 runs would pass D1's statement limit. The request is
 * `[<row JSON>,<raw run file>]` with the row's length (UTF-16 code units) in X-Slseoun-Row-Length,
 * so the Worker parses only the small row and binds the raw unparsed (R14c). The design names a
 * header or query field for the row; its 64 KB cap does not fit Cloudflare's per-header and URL
 * limits, so the row rides at the front of the body instead (a valid JSON array, nothing parsed but
 * the row).
 *
 * The step 1 routes (POST /api/write/history-runs and /batch) answer 409 single_run_required on the
 * D1 source; the client then sends each run to /api/write/history-runs/share.
 */

export const SINGLE_RUN_REQUIRED = "single_run_required";
export const SHARE_ROW_HEADER = "X-Slseoun-Row-Length";
export const SHARE_ROW_MAX_CHARS = 64 * 1024;
export const COVER_SPEC_MAX_BYTES = 16 * 1024;
const NICKNAME_MAX = 64;

export function singleRunRequired(): Response {
  return jsonResponse({ error: SINGLE_RUN_REQUIRED }, { status: 409 });
}

type ShareRow = Record<string, unknown>;

function intOrNull(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return Number.isSafeInteger(value) ? (value as number) : undefined;
}

/** The R14 row from the client's runs row (parsedMetaFromRun) plus the list summary (design 4.4). */
export function parseShareRow(value: unknown, uid: string): { row: ShareRow; nickname: string } | "invalid" | "forbidden" {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "invalid";
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || !isRunId(input.id)) return "invalid";
  if (input.donor_user_id !== uid) return "forbidden";
  if ("env" in input && typeof input.env !== "string") return "invalid";
  for (const name of ["seed", "build", "character"]) if (typeof input[name] !== "string") return "invalid";
  if (!Number.isSafeInteger(input.ascension) || !Number.isSafeInteger(input.acts_count)) return "invalid";
  if (typeof input.win !== "boolean") return "invalid";
  const startTime = intOrNull(input.start_time);
  const runTime = intOrNull(input.run_time);
  const totalFloors = input.total_floors === undefined ? 0 : intOrNull(input.total_floors);
  if (startTime === undefined || runTime === undefined || totalFloors === undefined || totalFloors === null) return "invalid";
  if (input.cover_spec !== undefined && input.cover_spec !== null && (typeof input.cover_spec !== "object" || Array.isArray(input.cover_spec))) {
    return "invalid";
  }
  if (input.badges !== undefined && !Array.isArray(input.badges)) return "invalid";
  const nickname = input.donor_nickname === undefined ? "닉" : input.donor_nickname;
  if (typeof nickname !== "string") return "invalid";
  const row: ShareRow = {
    id: input.id,
    seed: input.seed,
    build: input.build,
    character: input.character,
    ascension: input.ascension,
    win: input.win,
    start_time: startTime,
    run_time: runTime,
    acts_count: input.acts_count,
    total_floors: totalFloors,
    cover_spec: input.cover_spec ?? null,
    badges: input.badges ?? [],
  };
  // The summary columns the browser computed with extractRunListSummary (design 10.2): all or none.
  const summaryVersion = input.summary_version;
  if (summaryVersion !== undefined && summaryVersion !== 0) {
    if (!Number.isSafeInteger(summaryVersion) || (summaryVersion as number) < 0) return "invalid";
    if (!Array.isArray(input.characters) || typeof input.game_mode !== "string" || !Array.isArray(input.game_elements)) return "invalid";
    if (!input.list_facts || typeof input.list_facts !== "object" || Array.isArray(input.list_facts)) return "invalid";
    Object.assign(row, {
      summary_version: summaryVersion,
      characters: input.characters,
      game_mode: input.game_mode,
      game_elements: input.game_elements,
      list_facts: input.list_facts,
    });
  }
  return { row, nickname };
}

export async function shareRun(write: D1WriteContext): Promise<Response> {
  const stream = write.context.bodyStream;
  const declared = Number(write.context.request.headers.get(SHARE_ROW_HEADER) ?? "");
  if (!stream || !Number.isSafeInteger(declared) || declared < 2 || declared > SHARE_ROW_MAX_CHARS) return apiError("invalid");
  const text = await new Response(stream).text();
  // [<row>,<raw>]: the raw is bound as text and never parsed here (R14c).
  if (text.length < declared + 3 || text[0] !== "[" || text[declared + 1] !== "," || text[text.length - 1] !== "]") {
    return apiError("invalid");
  }
  let parsedRow: unknown;
  try {
    parsedRow = JSON.parse(text.slice(1, declared + 1));
  } catch {
    return apiError("invalid");
  }
  const raw = text.slice(declared + 2, -1);
  const parsed = parseShareRow(parsedRow, write.uid);
  if (parsed === "invalid" || parsed === "forbidden") return apiError(parsed);
  const { row, nickname } = parsed;
  const id = row.id as string;
  const rows = JSON.stringify([row]);
  let results;
  try {
    results = await runBatch(write.db, [
      // R14a: counts start from threads, so a re-shared run keeps its likes and comments.
      stmt(
        "INSERT INTO posts (service, id, user_id, nickname, created_at, title, summary, like_count, comment_count) " +
          "SELECT 'history_course', json_extract(e.value, '$.id'), ?1, ?2, ?3, NULL, " +
          "substr(trim(coalesce(nullif(json_extract(e.value, '$.seed'), ''), json_extract(e.value, '$.id'))), 1, 120), " +
          "coalesce(t.like_count, 0), coalesce(t.comment_count, 0) " +
          "FROM json_each(?4) e LEFT JOIN threads t ON t.thread_key = 'history-course:' || json_extract(e.value, '$.id') " +
          "WHERE true ON CONFLICT (service, id) DO NOTHING RETURNING id",
        write.uid, nickname, write.now, rows,
      ),
      // R14b
      stmt(
        "INSERT INTO post_history_course (service, post_id, seed, build, \"character\", ascension, win, start_time, run_time, acts_count, " +
          "total_floors, cover_spec, summary_version, badges, characters, game_mode, game_elements, list_facts) " +
          "SELECT p.service, p.id, json_extract(e.value, '$.seed'), json_extract(e.value, '$.build'), " +
          "json_extract(e.value, '$.character'), json_extract(e.value, '$.ascension'), json_extract(e.value, '$.win'), " +
          "json_extract(e.value, '$.start_time'), json_extract(e.value, '$.run_time'), json_extract(e.value, '$.acts_count'), " +
          "coalesce(json_extract(e.value, '$.total_floors'), 0), json_extract(e.value, '$.cover_spec'), " +
          "coalesce(json_extract(e.value, '$.summary_version'), 0), coalesce(json_extract(e.value, '$.badges'), '[]'), " +
          "json_extract(e.value, '$.characters'), json_extract(e.value, '$.game_mode'), json_extract(e.value, '$.game_elements'), " +
          "json_extract(e.value, '$.list_facts') " +
          "FROM json_each(?1) e CROSS JOIN posts p " +
          "ON p.service = 'history_course' AND p.id = json_extract(e.value, '$.id') AND p.user_id = ?2 " +
          "WHERE true ON CONFLICT (service, post_id) DO NOTHING",
        rows, write.uid,
      ),
      // R14c
      stmt(
        "INSERT INTO post_history_course_file (service, post_id, raw) SELECT 'history_course', ?1, ?2 " +
          "WHERE EXISTS (SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?3) " +
          "ON CONFLICT (service, post_id) DO NOTHING",
        id, raw, write.uid,
      ),
      // R14d
      stmt(
        "INSERT INTO outbox (table_name, op, match_key, payload, created_at) " +
          "SELECT 'runs', 'upsert', json_object('id', ?1), json_object('read', 'post_history_course'), ?3 " +
          "WHERE EXISTS (SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?2)",
        id, write.uid, write.nowMs,
      ),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const inserted = rowsOf<{ id: string }>(results[0]).map((entry) => String(entry.id));
  return json({ v: 1, env: write.dataEnv, inserted }, 201);
}

export async function updateCover(write: D1WriteContext): Promise<Response> {
  const id = write.context.url.searchParams.get("id") ?? "";
  const body = write.context.body as { coverSpec?: unknown } | null;
  if (!isRunId(id) || !body || typeof body !== "object" || !body.coverSpec || typeof body.coverSpec !== "object") return apiError("invalid");
  const coverSpec = JSON.stringify(body.coverSpec);
  if (new TextEncoder().encode(coverSpec).byteLength > COVER_SPEC_MAX_BYTES) return apiError("invalid");
  let results;
  try {
    results = await runBatch(write.db, [
      // R11
      stmt(
        "UPDATE post_history_course SET cover_spec = ?3 WHERE service = 'history_course' AND post_id = ?1 " +
          "AND EXISTS (SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?2) RETURNING post_id",
        id, write.uid, coverSpec,
      ),
      outboxStatement(
        { table: "runs", op: "update", match: { id, donor_user_id: write.uid }, payload: { read: "post_history_course", columns: ["cover_spec"] } },
        write.nowMs,
        { sql: "EXISTS (SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?6 AND user_id = ?7)", params: [id, write.uid] },
      ),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv, updated: rowsOf(results[0]).length > 0 });
}

export async function syncNicknames(write: D1WriteContext): Promise<Response> {
  const body = write.context.body as { nickname?: unknown } | null;
  const nickname = body && typeof body === "object" ? body.nickname : undefined;
  if (typeof nickname !== "string" || nickname.length > NICKNAME_MAX) return apiError("invalid");
  try {
    await runBatch(write.db, [
      // One outbox update per run R12 is about to change (read first in the same batch).
      stmt(
        "INSERT INTO outbox (table_name, op, match_key, payload, created_at) " +
          "SELECT 'runs', 'update', json_object('id', id, 'donor_user_id', user_id), " +
          "json_object('read', 'post_history_course', 'columns', json_array('donor_nickname')), ?3 " +
          "FROM posts WHERE user_id = ?1 AND service = 'history_course' AND nickname <> ?2",
        write.uid, nickname, write.nowMs,
      ),
      // R12
      stmt(
        "UPDATE posts SET nickname = ?2 WHERE (service, id) IN (SELECT service, id FROM posts WHERE user_id = ?1 AND service = 'history_course') " +
          "AND nickname <> ?2",
        write.uid, nickname,
      ),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv });
}

export async function deleteRun(write: D1WriteContext): Promise<Response> {
  const id = write.context.url.searchParams.get("id") ?? "";
  if (!isRunId(id)) return apiError("invalid");
  let results;
  try {
    results = await runBatch(write.db, [
      // R13: cascades the run row and the file; threads stay.
      stmt("DELETE FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?2 RETURNING id", id, write.uid),
      outboxStatement({ table: "runs", op: "delete", match: { id, donor_user_id: write.uid }, payload: null }, write.nowMs),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv, deleted: rowsOf(results[0]).length > 0 });
}

/** POST /api/write/history-runs and /batch on the D1 source: the client resends one run at a time. */
export async function batchShareOnD1(write: D1WriteContext): Promise<Response> {
  void write.context.bodyStream?.cancel().catch(() => undefined);
  return singleRunRequired();
}

import {
  HISTORY_RUN_RAW_PATH,
  HISTORY_RUN_REFERENCE_LIMIT,
  isHistoryRunsView,
  isHistoryRunView,
  isRunId,
  parseRunIds,
  RECENT_DONATED_RUNS_LIMIT,
  RUN_DETAIL_COLUMNS,
  RUN_SUMMARY_COLUMNS,
} from "../../../src/lib/history-runs-api-rules";
import { API_MARKER_HEADER, apiError, jsonResponse, PRIVATE_NO_STORE, textResponse } from "../http";
import type { ApiRoute, PublicRouteContext, UserRouteContext } from "../router";
import { postgrest, postgrestStream } from "../supabase-rest";
import { HANDLER_BUDGET_MS, restErrorCode } from "./comments";
import { readAfterWrite } from "../../sync/read-after-write";
import { RAW_RUN_NICKNAMES } from "../../sync/sync-sql";
import { workerUploadAnswer } from "./history-runs-share";

/**
 * The history-runs group (docs/supabase-exit/STEP1_DESIGN.md 9.6). Run rows
 * carry the raw run file (up to 260 KB each; the list of 100 is about 8 MB),
 * which the Worker cannot parse inside its CPU budget. Reads that include `raw`
 * stream PostgREST's body through unparsed inside a `{v, env, rows}` envelope,
 * and uploads stream the request body to PostgREST unparsed. Everything small
 * is handled like the other groups.
 */

/**
 * Waiting on I/O costs no Worker CPU, so streamed calls get wall-clock limits
 * under the client's (20 s for lists, 30 s for uploads) instead of the 6.5 s
 * endpoint budget: an upload's header timer also covers the browser's upload.
 */
const STREAM_READ_MS = 15_000;
const STREAM_UPLOAD_MS = 25_000;
/** One upload batch; the client sends what the user picked (raw files up to 2 MB). */
const UPLOAD_MAX_BYTES = 24 * 1024 * 1024;
const NICKNAME_MAX = 64;
const COVER_SPEC_MAX_BYTES = 16 * 1024;
const ENGAGEMENT_ROWS = 1000;

/**
 * PostgREST's JSON array, handed to the client by the runtime without any JS
 * touching it: a JS pump over the 5.5 MB development list cost 77-204 ms CPU
 * on testbed (Free allows 10 ms). The answer is a bare array of rows; its size
 * is bounded by the query (100 rows) and the table's raw cap.
 */
function streamedRows(response: Response, env: string): Response {
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": PRIVATE_NO_STORE,
      "X-Robots-Tag": "noindex",
      "X-Slseoun-Api-Env": env,
      [API_MARKER_HEADER]: "1",
    },
  });
}

/** Streams `select` rows. */
async function streamSelect(
  context: PublicRouteContext,
  query: Record<string, string>,
  select: string,
): Promise<Response> {
  const { config } = context;
  const result = await postgrestStream(config, {
    path: "runs",
    deadline: Date.now() + STREAM_READ_MS,
    timeoutMs: STREAM_READ_MS,
    query: new URLSearchParams({ ...query, select, env: `eq.${config.dataEnv}` }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return streamedRows(result.response, config.dataEnv);
}

async function handleList(context: PublicRouteContext): Promise<Response> {
  const view = context.url.searchParams.get("view") ?? "";
  if (!isHistoryRunsView(view)) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: context.config.dataEnv });
  return view === "recent"
    ? streamSelect(context, { order: "created_at.desc", limit: String(RECENT_DONATED_RUNS_LIMIT) }, RUN_SUMMARY_COLUMNS)
    : streamSelect(context, { order: "start_time.desc", limit: String(HISTORY_RUN_REFERENCE_LIMIT) }, RUN_SUMMARY_COLUMNS);
}

async function handleOne(context: PublicRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  const view = context.url.searchParams.get("view") ?? "detail";
  if (!isRunId(id) || !isHistoryRunView(view)) return apiError("invalid");
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const one = { id: `eq.${id}`, limit: "1" };
  if (view === "detail") return streamSelect(context, one, RUN_DETAIL_COLUMNS);
  if (view === "cover") return streamSelect(context, one, "id,raw,cover_spec");
  // meta: no raw, small enough to read here (OG fields, "is it shared").
  const result = await postgrest<unknown[]>(config, {
    path: "runs",
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ select: "id,character,cover_spec", env: `eq.${config.dataEnv}`, ...one }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

/** The JSON answer of one raw file: the escaped text of a 1.9 MB raw (the D1 cap) fits. */
const RAW_ANSWER_MAX_BYTES = 4 * 1024 * 1024;

/**
 * One run's raw file as text/plain (R3r). Supabase's PostgREST answers a one-column select only as
 * JSON (Accept: text/plain is PGRST107 without a media type handler), so this reads the row and
 * answers its text. Raws are 57 KB at the median and 277 KB at most today.
 */
async function handleRaw(context: PublicRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isRunId(id)) return apiError("invalid");
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrest<Array<{ raw?: unknown }>>(config, {
    path: "runs",
    deadline: Date.now() + STREAM_READ_MS,
    timeoutMs: STREAM_READ_MS,
    maxBytes: RAW_ANSWER_MAX_BYTES,
    query: new URLSearchParams({ select: "raw", id: `eq.${id}`, env: `eq.${config.dataEnv}`, limit: "1" }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  const raw = Array.isArray(result.data) ? result.data[0]?.raw : undefined;
  return textResponse(typeof raw === "string" ? raw : "", config.dataEnv);
}

async function handleEngagement(context: PublicRouteContext): Promise<Response> {
  const ids = parseRunIds(context.url.searchParams.get("ids") ?? "");
  if (!ids) return apiError("invalid");
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const keys = ids.map((id) => `"history-course:${id}"`).join(",");
  const deadline = Date.now() + HANDLER_BUDGET_MS;
  // Same two reads as use-history-course-engagement.ts, counted here instead of in the browser.
  const read = (table: string) => postgrest<{ story_id: string }[]>(config, {
    path: table,
    deadline,
    query: new URLSearchParams({
      select: "story_id",
      env: `eq.${config.dataEnv}`,
      story_id: `in.(${keys})`,
      limit: String(ENGAGEMENT_ROWS),
    }),
  });
  const [likes, comments] = await Promise.all([read("likes"), read("comments")]);
  if (!likes.ok) return apiError(restErrorCode(likes));
  if (!comments.ok) return apiError(restErrorCode(comments));
  const count = (rows: { story_id: string }[] | null) => {
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) {
      const id = String(row.story_id).slice("history-course:".length);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  };
  return jsonResponse({ v: 1, env: config.dataEnv, likes: count(likes.data), comments: count(comments.data) });
}

async function handleMine(context: UserRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id");
  if (id !== null && !isRunId(id)) return apiError("invalid");
  const { config, token, user } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrest<{ id: string }[]>(config, {
    path: "runs",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({
      select: "id",
      env: `eq.${config.dataEnv}`,
      donor_user_id: `eq.${user.userId}`,
      ...(id ? { id: `eq.${id}` } : {}),
    }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, ids: (result.data ?? []).map((row) => String(row.id)) });
}

async function streamUpload(context: UserRouteContext, batch: boolean): Promise<Response> {
  // Step 4 worker mode: one run per request on the share route (STEP4_WRITE_GATE 9.5).
  const single = workerUploadAnswer(context);
  if (single) return single;
  const { config, token, bodyStream } = context;
  if (!bodyStream) return apiError("invalid");
  // The body is passed through unparsed: RLS checks donor_user_id = auth.uid() on
  // every row; the Worker cannot set env without parsing (STEP1_DESIGN 9.6).
  const result = await postgrestStream(config, {
    method: "POST",
    path: "runs",
    token,
    deadline: Date.now() + STREAM_UPLOAD_MS,
    timeoutMs: STREAM_UPLOAD_MS,
    bodyStream,
    query: batch ? new URLSearchParams({ on_conflict: "id,env", select: "id" }) : undefined,
    prefer: batch ? ["resolution=ignore-duplicates", "return=representation"] : ["return=minimal"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  if (!batch) {
    void result.response.body?.cancel().catch(() => undefined);
    // return=minimal: the donor's newest run is the one just uploaded (re-read without its raw).
    await readAfterWrite(context, "write.history-runs.create", [
      { op: "reread", table: "runs", match: { donor_user_id: context.user.userId }, order: "created_at.desc,id.desc", then: "insert" },
    ]);
    return jsonResponse({ v: 1, env: config.dataEnv }, { status: 201 });
  }
  // Ids only: small.
  const rows = await result.response.json().catch(() => null) as { id?: unknown }[] | null;
  if (!Array.isArray(rows)) return apiError("unavailable");
  const inserted = rows.map((row) => String(row.id));
  await readAfterWrite(context, "write.history-runs.batch", [{ op: "rereadIds", table: "runs", ids: inserted }]);
  return jsonResponse({ v: 1, env: config.dataEnv, inserted }, { status: 201 });
}

async function handleCover(context: UserRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  const body = context.body as { coverSpec?: unknown } | null;
  if (!isRunId(id) || !body || typeof body !== "object" || !body.coverSpec || typeof body.coverSpec !== "object") {
    return apiError("invalid");
  }
  if (new TextEncoder().encode(JSON.stringify(body.coverSpec)).byteLength > COVER_SPEC_MAX_BYTES) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrest<{ id: string }[]>(config, {
    method: "PATCH",
    path: "runs",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ id: `eq.${id}`, env: `eq.${config.dataEnv}`, donor_user_id: `eq.${user.userId}`, select: "id" }),
    body: { cover_spec: body.coverSpec },
    prefer: ["return=representation"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  const updated = (result.data ?? []).length > 0;
  if (updated) {
    await readAfterWrite(context, "write.history-runs.cover", [
      { op: "update", table: "runs", key: { id }, set: { cover_spec: body.coverSpec } },
    ]);
  }
  return jsonResponse({ v: 1, env: config.dataEnv, updated });
}

async function handleNicknames(context: UserRouteContext): Promise<Response> {
  const body = context.body as { nickname?: unknown } | null;
  const nickname = body && typeof body === "object" ? body.nickname : undefined;
  if (typeof nickname !== "string" || nickname.length > NICKNAME_MAX) return apiError("invalid");
  const { config, token, user } = context;
  // neq skips rows whose nickname is null, like the legacy update.
  const result = await postgrest<null>(config, {
    method: "PATCH",
    path: "runs",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ env: `eq.${config.dataEnv}`, donor_user_id: `eq.${user.userId}`, donor_nickname: `neq.${nickname}` }),
    body: { donor_nickname: nickname },
    prefer: ["return=minimal"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  await readAfterWrite(context, "write.history-runs.nicknames", [
    { op: "statement", statement: { sql: RAW_RUN_NICKNAMES, params: [nickname, user.userId] } },
  ]);
  return jsonResponse({ v: 1, env: config.dataEnv });
}

async function handleDelete(context: UserRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isRunId(id)) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrest<{ id: string }[]>(config, {
    method: "DELETE",
    path: "runs",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ id: `eq.${id}`, env: `eq.${config.dataEnv}`, donor_user_id: `eq.${user.userId}`, select: "id" }),
    prefer: ["return=representation"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  const deleted = (result.data ?? []).length > 0;
  if (deleted) await readAfterWrite(context, "write.history-runs.delete", [{ op: "delete", table: "runs", key: { id } }]);
  return jsonResponse({ v: 1, env: config.dataEnv, deleted });
}

const idQuery = { id: isRunId };

export const historyRunsRoutes: readonly ApiRoute[] = [
  {
    id: "read.history-runs",
    method: "GET",
    path: "/api/read/history-runs",
    group: "history-runs",
    access: "public",
    query: { view: isHistoryRunsView },
    rateLimit: "ip",
    handle: handleList,
  },
  {
    id: "read.history-run",
    method: "GET",
    path: "/api/read/history-run",
    group: "history-runs",
    access: "public",
    query: { id: isRunId, view: isHistoryRunView },
    rateLimit: "ip",
    handle: handleOne,
  },
  {
    id: "read.history-run.raw",
    method: "GET",
    path: HISTORY_RUN_RAW_PATH,
    group: "history-runs",
    access: "public",
    query: idQuery,
    rateLimit: "ip",
    handle: handleRaw,
  },
  {
    id: "read.history-runs.engagement",
    method: "GET",
    path: "/api/read/history-runs/engagement",
    group: "history-runs",
    access: "public",
    query: { ids: (value: string) => parseRunIds(value) !== null },
    rateLimit: "ip",
    handle: handleEngagement,
  },
  {
    id: "me.history-runs",
    method: "GET",
    path: "/api/me/history-runs",
    group: "history-runs",
    access: "me",
    query: idQuery,
    handle: handleMine,
  },
  {
    id: "write.history-runs.create",
    method: "POST",
    path: "/api/write/history-runs",
    group: "history-runs",
    access: "write",
    query: {},
    rawBody: { maxBytes: UPLOAD_MAX_BYTES },
    handle: (context) => streamUpload(context, false),
  },
  {
    id: "write.history-runs.batch",
    method: "POST",
    path: "/api/write/history-runs/batch",
    group: "history-runs",
    access: "write",
    query: {},
    rawBody: { maxBytes: UPLOAD_MAX_BYTES },
    handle: (context) => streamUpload(context, true),
  },
  {
    id: "write.history-runs.cover",
    method: "PATCH",
    path: "/api/write/history-runs/cover",
    group: "history-runs",
    access: "write",
    query: idQuery,
    body: { maxBytes: COVER_SPEC_MAX_BYTES + 1024 },
    handle: handleCover,
  },
  {
    id: "write.history-runs.nicknames",
    method: "POST",
    path: "/api/write/history-runs/nicknames",
    group: "history-runs",
    access: "write",
    query: {},
    body: { maxBytes: 1024 },
    handle: handleNicknames,
  },
  {
    id: "write.history-runs.delete",
    method: "DELETE",
    path: "/api/write/history-runs",
    group: "history-runs",
    access: "write",
    query: idQuery,
    handle: handleDelete,
  },
];

import {
  isCursorCreatedAt,
  isCursorScore,
  isDefragmentRunSort,
  isPostUuid,
  isRowId,
  isSourceService,
  isToyboxFeedService,
  isToyboxFeedSort,
  isToyboxPostService,
  isToyboxUpdatable,
  parsePostIds,
  THIS_OR_THAT_CHOICES,
  THIS_OR_THAT_SUMMARY_IDS,
  THIS_OR_THAT_VOTE_SURFACES,
  TOYBOX_PAGE_SIZE,
  TOYBOX_POST_TABLES,
  type ToyboxPostService,
} from "../../../src/lib/toybox-api-rules";
import { apiError, jsonResponse, passthroughJson } from "../http";
import type { ApiRoute, PublicRouteContext, UserRouteContext } from "../router";
import { postgrest, postgrestStream, type StreamRequest, type SupabaseApiConfig } from "../supabase-rest";
import { HANDLER_BUDGET_MS, restErrorCode } from "./comments";

/**
 * The toybox-feed group (docs/supabase-exit/STEP1_DESIGN.md 9.8): the feeds of
 * the toybox services and the defragment board, one post, writing posts, this
 * or that likes and votes, the favorite tournament and pagestorm drafts. Posts
 * can be 1 MB or more (decisions rows, pagestorm documents), so post bodies and
 * feeds pass through unparsed (9.6); post writes stream the body and rely on RLS
 * (user_id = auth.uid()) and the guard triggers, like run uploads.
 */

const STREAM_MS = 15_000;
const UPLOAD_MS = 25_000;
const POST_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const DRAFT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const PAGESTORM_LIST_COLUMNS = "id,user_id,nickname,title,content,content_text,env,created_at,avatar_id,avatar_kind,palette_id,palette_swapped";
export const DEFRAGMENT_RUN_COLUMNS = "id,created_at,like_count,comment_count,seed,donor_user_id,donor_nickname,cover_spec,win,ascension,total_floors";

async function stream(context: PublicRouteContext | UserRouteContext, request: Omit<StreamRequest, "deadline" | "timeoutMs">, status = 200): Promise<Response> {
  const { config } = context;
  const result = await postgrestStream(config, { ...request, deadline: Date.now() + STREAM_MS, timeoutMs: STREAM_MS });
  if (!result.ok) return apiError(restErrorCode(result));
  return passthroughJson(result.response, config.dataEnv, status);
}

function table(service: ToyboxPostService): string {
  return TOYBOX_POST_TABLES[service];
}

/** The three cursor fields, all or none, or null when malformed. */
function readCursor(url: URL): { score: string; createdAt: string; id: string } | null | "invalid" {
  const score = url.searchParams.get("score");
  const createdAt = url.searchParams.get("created_at");
  const id = url.searchParams.get("cursor_id");
  if (score === null && createdAt === null && id === null) return null;
  if (score === null || createdAt === null || id === null) return "invalid";
  if (!isCursorScore(score) || !isCursorCreatedAt(createdAt) || !isRowId(id)) return "invalid";
  return { score, createdAt, id };
}

const cursorSchema = { score: isCursorScore, created_at: isCursorCreatedAt, cursor_id: isRowId };

// --- Feeds ------------------------------------------------------------------------

async function handleToyboxFeed(context: PublicRouteContext): Promise<Response> {
  const { url, config } = context;
  const service = url.searchParams.get("service") ?? "";
  const sort = url.searchParams.get("sort") ?? "";
  const cursor = readCursor(url);
  if (!isToyboxFeedService(service) || !isToyboxFeedSort(sort) || cursor === "invalid") return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  return stream(context, {
    method: "POST",
    path: "rpc/get_toybox_feed",
    body: {
      p_env: config.dataEnv,
      p_service: service,
      p_sort: sort,
      p_limit: TOYBOX_PAGE_SIZE,
      p_cursor_score: cursor ? Number(cursor.score) : null,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    },
  });
}

async function handleDefragmentFeed(context: PublicRouteContext): Promise<Response> {
  const { url, config } = context;
  const sort = url.searchParams.get("sort") ?? "";
  const cursor = readCursor(url);
  if (!isToyboxFeedSort(sort) || cursor === "invalid") return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  return stream(context, {
    method: "POST",
    path: "rpc/get_defragment_feed_v2",
    body: {
      p_env: config.dataEnv,
      p_sort: sort,
      p_limit: TOYBOX_PAGE_SIZE,
      p_cursor_score: cursor ? Number(cursor.score) : null,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    },
  });
}

/** History-course rows on the defragment board (defragment-feed.ts fetchHistoryCourseDefragmentPage). */
async function handleDefragmentRuns(context: PublicRouteContext): Promise<Response> {
  const { url, config } = context;
  const sort = url.searchParams.get("sort") ?? "";
  const cursor = readCursor(url);
  if (!isDefragmentRunSort(sort) || cursor === "invalid") return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const scoreColumn = sort === "comments" ? "comment_count" : "like_count";
  const query = new URLSearchParams({
    select: DEFRAGMENT_RUN_COLUMNS,
    env: `eq.${config.dataEnv}`,
    order: sort === "latest" ? "created_at.desc,id.desc" : `${scoreColumn}.desc,created_at.desc,id.desc`,
    limit: String(TOYBOX_PAGE_SIZE),
  });
  // The cursor values were checked against digit, ISO and id patterns, so they need no escaping.
  if (cursor && sort === "latest") {
    query.set("or", `(created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt."${cursor.id}"))`);
  } else if (cursor) {
    query.set(
      "or",
      `(${scoreColumn}.lt.${cursor.score},and(${scoreColumn}.eq.${cursor.score},created_at.lt."${cursor.createdAt}"),and(${scoreColumn}.eq.${cursor.score},created_at.eq."${cursor.createdAt}",id.lt."${cursor.id}"))`,
    );
  }
  return stream(context, { path: "runs", query });
}

// --- Posts ------------------------------------------------------------------------

async function handleReadPost(context: PublicRouteContext): Promise<Response> {
  const { url, config } = context;
  const service = url.searchParams.get("service") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!isToyboxPostService(service) || !isPostUuid(id)) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  return stream(context, {
    path: table(service),
    query: new URLSearchParams({ select: "*", id: `eq.${id.toLowerCase()}`, env: `eq.${config.dataEnv}`, limit: "1" }),
  });
}

async function handleCreatePost(context: UserRouteContext): Promise<Response> {
  const service = context.url.searchParams.get("service") ?? "";
  if (!isToyboxPostService(service) || !context.bodyStream) return apiError("invalid");
  const { config, token } = context;
  // Unparsed: RLS checks user_id = auth.uid(); guard triggers reset counters and created_at.
  const result = await postgrestStream(config, {
    method: "POST",
    path: table(service),
    token,
    bodyStream: context.bodyStream,
    query: new URLSearchParams({ select: "*" }),
    prefer: ["return=representation"],
    deadline: Date.now() + UPLOAD_MS,
    timeoutMs: UPLOAD_MS,
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return passthroughJson(result.response, config.dataEnv, 201);
}

async function handleUpdatePost(context: UserRouteContext): Promise<Response> {
  const service = context.url.searchParams.get("service") ?? "";
  const id = context.url.searchParams.get("id") ?? "";
  if (!isToyboxPostService(service) || !isToyboxUpdatable(service) || !isPostUuid(id) || !context.bodyStream) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrestStream(config, {
    method: "PATCH",
    path: table(service),
    token,
    bodyStream: context.bodyStream,
    query: new URLSearchParams({ id: `eq.${id.toLowerCase()}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}`, select: "*" }),
    prefer: ["return=representation"],
    deadline: Date.now() + UPLOAD_MS,
    timeoutMs: UPLOAD_MS,
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return passthroughJson(result.response, config.dataEnv);
}

async function deleteOwn(context: UserRouteContext, path: string, id: string): Promise<Response> {
  const { config, token, user } = context;
  const result = await postgrest<{ id: string }[]>(config, {
    method: "DELETE",
    path,
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ id: `eq.${id.toLowerCase()}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}`, select: "id" }),
    prefer: ["return=representation"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, deleted: (result.data ?? []).length > 0 });
}

async function handleDeletePost(context: UserRouteContext): Promise<Response> {
  const service = context.url.searchParams.get("service") ?? "";
  const id = context.url.searchParams.get("id") ?? "";
  if (!isToyboxPostService(service) || !isPostUuid(id)) return apiError("invalid");
  return deleteOwn(context, table(service), id);
}

// --- Favorite tournament -----------------------------------------------------------------

async function handleTournamentPresets(context: PublicRouteContext): Promise<Response> {
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  return stream(context, {
    path: "favorite_tournament_posts",
    query: new URLSearchParams({ select: "*", env: `eq.${config.dataEnv}`, preset_key: "like.builtin:*", order: "created_at.asc" }),
  });
}

async function handleTournamentStats(context: PublicRouteContext): Promise<Response> {
  const { config, url } = context;
  const id = url.searchParams.get("id") ?? "";
  if (!isPostUuid(id)) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  return stream(context, {
    path: "favorite_tournament_candidate_stats",
    query: new URLSearchParams({ select: "*", tournament_id: `eq.${id.toLowerCase()}`, env: `eq.${config.dataEnv}` }),
  });
}

async function handleTournamentPlay(context: UserRouteContext): Promise<Response> {
  const body = context.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("invalid");
  const { tournamentId, startingSize, championType, championId, matches } = body;
  if (typeof tournamentId !== "string" || !isPostUuid(tournamentId)) return apiError("invalid");
  if (!Number.isInteger(startingSize) || typeof championType !== "string" || typeof championId !== "string") return apiError("invalid");
  if (!Array.isArray(matches)) return apiError("invalid");
  const { config, token } = context;
  // The RPC checks the size, bracket and candidates itself (schema:396-543); a pool of
  // every card and relic (about 1,000 entries, 120 KB of matches) fits the body cap.
  const result = await postgrest<unknown>(config, {
    method: "POST",
    path: "rpc/complete_favorite_tournament_play",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: {
      p_tournament_id: tournamentId.toLowerCase(),
      p_env: config.dataEnv,
      p_starting_size: startingSize,
      p_champion_type: championType,
      p_champion_id: championId,
      p_matches: matches,
    },
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, result: result.data ?? null });
}

// --- Pagestorm -----------------------------------------------------------------------------

async function handlePagestormPosts(context: PublicRouteContext): Promise<Response> {
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  return stream(context, {
    path: "pagestorm_posts",
    query: new URLSearchParams({ select: PAGESTORM_LIST_COLUMNS, env: `eq.${config.dataEnv}`, order: "created_at.desc", limit: "50" }),
  });
}

async function handleMyDrafts(context: UserRouteContext): Promise<Response> {
  const { config, token, user, url } = context;
  const id = url.searchParams.get("id");
  if (id !== null && !isPostUuid(id)) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const query = id
    ? new URLSearchParams({ select: "*", id: `eq.${id.toLowerCase()}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}`, limit: "1" })
    : new URLSearchParams({ select: PAGESTORM_LIST_COLUMNS, env: `eq.${config.dataEnv}`, user_id: `eq.${user.userId}`, order: "updated_at.desc", limit: "20" });
  return stream(context, { path: "pagestorm_drafts", token, query });
}

async function handleCreateDraft(context: UserRouteContext): Promise<Response> {
  if (!context.bodyStream) return apiError("invalid");
  const { config, token } = context;
  const result = await postgrestStream(config, {
    method: "POST",
    path: "pagestorm_drafts",
    token,
    bodyStream: context.bodyStream,
    query: new URLSearchParams({ select: "*" }),
    prefer: ["return=representation"],
    deadline: Date.now() + UPLOAD_MS,
    timeoutMs: UPLOAD_MS,
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return passthroughJson(result.response, config.dataEnv, 201);
}

async function handleUpdateDraft(context: UserRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isPostUuid(id) || !context.bodyStream) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrestStream(config, {
    method: "PATCH",
    path: "pagestorm_drafts",
    token,
    bodyStream: context.bodyStream,
    query: new URLSearchParams({ id: `eq.${id.toLowerCase()}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}`, select: "*" }),
    prefer: ["return=representation"],
    deadline: Date.now() + UPLOAD_MS,
    timeoutMs: UPLOAD_MS,
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return passthroughJson(result.response, config.dataEnv);
}

async function handleDeleteDraft(context: UserRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isPostUuid(id)) return apiError("invalid");
  return deleteOwn(context, "pagestorm_drafts", id);
}

// --- Defragment bodies -----------------------------------------------------------------------

async function handleReadBody(context: PublicRouteContext): Promise<Response> {
  const { config, url } = context;
  const service = url.searchParams.get("service") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!isSourceService(service) || !isRowId(id)) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  return stream(context, {
    path: "defragment_bodies",
    query: new URLSearchParams({ select: "*", env: `eq.${config.dataEnv}`, source_service: `eq.${service}`, source_id: `eq.${id}`, limit: "1" }),
  });
}

async function handleUpsertBody(context: UserRouteContext): Promise<Response> {
  if (!context.bodyStream) return apiError("invalid");
  const { config, token } = context;
  // RLS: user_id = auth.uid() and defragment_source_owned (schema:4975, 4989).
  const result = await postgrestStream(config, {
    method: "POST",
    path: "defragment_bodies",
    token,
    bodyStream: context.bodyStream,
    query: new URLSearchParams({ on_conflict: "env,source_service,source_id", select: "*" }),
    prefer: ["resolution=merge-duplicates", "return=representation"],
    deadline: Date.now() + UPLOAD_MS,
    timeoutMs: UPLOAD_MS,
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return passthroughJson(result.response, config.dataEnv);
}

// --- This or that ------------------------------------------------------------------------------

function inList(ids: readonly string[]): string {
  return `in.(${ids.join(",")})`;
}

async function readRows(config: SupabaseApiConfig, path: string, query: Record<string, string>, token?: string) {
  return postgrest<Record<string, unknown>[]>(config, { path, token, deadline: Date.now() + HANDLER_BUDGET_MS, query: new URLSearchParams(query) });
}

async function handleLikeCounts(context: PublicRouteContext): Promise<Response> {
  const ids = parsePostIds(context.url.searchParams.get("ids") ?? "");
  if (!ids) return apiError("invalid");
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await readRows(config, "this_or_that_post_like_counts", { select: "post_id,like_count", env: `eq.${config.dataEnv}`, post_id: inList(ids) });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

async function handleMyLikes(context: UserRouteContext): Promise<Response> {
  const ids = parsePostIds(context.url.searchParams.get("ids") ?? "");
  if (!ids) return apiError("invalid");
  const { config, token, user } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await readRows(config, "this_or_that_post_likes", { select: "post_id", env: `eq.${config.dataEnv}`, user_id: `eq.${user.userId}`, post_id: inList(ids) }, token);
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

async function handleLike(context: UserRouteContext, like: boolean): Promise<Response> {
  const id = (context.url.searchParams.get("id") ?? "").toLowerCase();
  if (!isPostUuid(id)) return apiError("invalid");
  const { config, token, user } = context;
  const deadline = Date.now() + HANDLER_BUDGET_MS;
  const result = like
    ? await postgrest<null>(config, { method: "POST", path: "this_or_that_post_likes", token, deadline, body: { post_id: id, user_id: user.userId, env: config.dataEnv }, prefer: ["return=minimal"] })
    : await postgrest<null>(config, { method: "DELETE", path: "this_or_that_post_likes", token, deadline, query: new URLSearchParams({ post_id: `eq.${id}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}` }), prefer: ["return=minimal"] });
  if (!result.ok && !(like && result.code === "23505")) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, liked: like });
}

async function handleVoteSummaries(context: PublicRouteContext): Promise<Response> {
  const ids = parsePostIds(context.url.searchParams.get("ids") ?? "", THIS_OR_THAT_SUMMARY_IDS);
  if (!ids) return apiError("invalid");
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrest<Record<string, unknown>[]>(config, {
    method: "POST",
    path: "rpc/get_this_or_that_vote_summaries",
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: { p_post_ids: ids, p_env: config.dataEnv },
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

async function handleMyVotes(context: UserRouteContext): Promise<Response> {
  const ids = parsePostIds(context.url.searchParams.get("ids") ?? "");
  if (!ids) return apiError("invalid");
  const { config, token, user } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await readRows(config, "this_or_that_post_votes", { select: "post_id,choice", env: `eq.${config.dataEnv}`, user_id: `eq.${user.userId}`, post_id: inList(ids) }, token);
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

async function handleVote(context: UserRouteContext): Promise<Response> {
  const id = (context.url.searchParams.get("id") ?? "").toLowerCase();
  const body = context.body as { choice?: unknown; surface?: unknown } | null;
  if (!isPostUuid(id) || !body || typeof body !== "object") return apiError("invalid");
  if (!(THIS_OR_THAT_CHOICES as readonly unknown[]).includes(body.choice) || !(THIS_OR_THAT_VOTE_SURFACES as readonly unknown[]).includes(body.surface)) {
    return apiError("invalid");
  }
  const { config, token, user } = context;
  // The insert policy also needs a post of the same env (schema:5377-5379).
  const result = await postgrest<null>(config, {
    method: "POST",
    path: "this_or_that_post_votes",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: { post_id: id, user_id: user.userId, choice: body.choice, created_surface: body.surface, env: config.dataEnv },
    prefer: ["return=minimal"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, choice: body.choice }, { status: 201 });
}

async function handleUnvote(context: UserRouteContext): Promise<Response> {
  const id = (context.url.searchParams.get("id") ?? "").toLowerCase();
  if (!isPostUuid(id)) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrest<null>(config, {
    method: "DELETE",
    path: "this_or_that_post_votes",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ post_id: `eq.${id}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}` }),
    prefer: ["return=minimal"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, choice: null });
}

const idQuery = { id: isPostUuid };
const idsQuery = { ids: (value: string) => parsePostIds(value) !== null };

type Ungrouped<T> = T extends ApiRoute ? Omit<T, "group"> : never;

function route(base: Ungrouped<ApiRoute>): ApiRoute {
  return { ...base, group: "toybox-feed" } as ApiRoute;
}

export const toyboxRoutes: readonly ApiRoute[] = [
  route({ id: "read.toybox-feed", method: "GET", path: "/api/read/toybox-feed", access: "public", rateLimit: "ip", query: { service: isToyboxFeedService, sort: isToyboxFeedSort, ...cursorSchema }, handle: handleToyboxFeed }),
  route({ id: "read.defragment-feed", method: "GET", path: "/api/read/defragment-feed", access: "public", rateLimit: "ip", query: { sort: isToyboxFeedSort, ...cursorSchema }, handle: handleDefragmentFeed }),
  route({ id: "read.defragment-runs", method: "GET", path: "/api/read/defragment-runs", access: "public", rateLimit: "ip", query: { sort: isDefragmentRunSort, ...cursorSchema }, handle: handleDefragmentRuns }),
  route({ id: "read.toybox-post", method: "GET", path: "/api/read/toybox-post", access: "public", rateLimit: "ip", query: { service: isToyboxPostService, id: isPostUuid }, handle: handleReadPost }),
  route({ id: "write.toybox-post.create", method: "POST", path: "/api/write/toybox-post", access: "write", query: { service: isToyboxPostService }, rawBody: { maxBytes: POST_UPLOAD_MAX_BYTES }, handle: handleCreatePost }),
  route({ id: "write.toybox-post.update", method: "PATCH", path: "/api/write/toybox-post", access: "write", query: { service: isToyboxPostService, ...idQuery }, rawBody: { maxBytes: POST_UPLOAD_MAX_BYTES }, handle: handleUpdatePost }),
  route({ id: "write.toybox-post.delete", method: "DELETE", path: "/api/write/toybox-post", access: "write", query: { service: isToyboxPostService, ...idQuery }, handle: handleDeletePost }),
  route({ id: "read.favorite-tournament.presets", method: "GET", path: "/api/read/favorite-tournament/presets", access: "public", rateLimit: "ip", query: {}, handle: handleTournamentPresets }),
  route({ id: "read.favorite-tournament.stats", method: "GET", path: "/api/read/favorite-tournament/stats", access: "public", rateLimit: "ip", query: idQuery, handle: handleTournamentStats }),
  route({ id: "write.favorite-tournament.play", method: "POST", path: "/api/write/favorite-tournament/play", access: "write", query: {}, body: { maxBytes: 256 * 1024 }, handle: handleTournamentPlay }),
  route({ id: "read.pagestorm.posts", method: "GET", path: "/api/read/pagestorm/posts", access: "public", rateLimit: "ip", query: {}, handle: handlePagestormPosts }),
  route({ id: "me.pagestorm.drafts", method: "GET", path: "/api/me/pagestorm/drafts", access: "me", query: idQuery, handle: handleMyDrafts }),
  route({ id: "write.pagestorm.drafts.create", method: "POST", path: "/api/write/pagestorm/drafts", access: "write", query: {}, rawBody: { maxBytes: DRAFT_UPLOAD_MAX_BYTES }, handle: handleCreateDraft }),
  route({ id: "write.pagestorm.drafts.update", method: "PATCH", path: "/api/write/pagestorm/drafts", access: "write", query: idQuery, rawBody: { maxBytes: DRAFT_UPLOAD_MAX_BYTES }, handle: handleUpdateDraft }),
  route({ id: "write.pagestorm.drafts.delete", method: "DELETE", path: "/api/write/pagestorm/drafts", access: "write", query: idQuery, handle: handleDeleteDraft }),
  route({ id: "read.defragment-body", method: "GET", path: "/api/read/defragment-body", access: "public", rateLimit: "ip", query: { service: isSourceService, id: isRowId }, handle: handleReadBody }),
  route({ id: "write.defragment-body", method: "PUT", path: "/api/write/defragment-body", access: "write", query: {}, rawBody: { maxBytes: POST_UPLOAD_MAX_BYTES }, handle: handleUpsertBody }),
  route({ id: "read.this-or-that.like-counts", method: "GET", path: "/api/read/this-or-that/like-counts", access: "public", rateLimit: "ip", query: idsQuery, handle: handleLikeCounts }),
  route({ id: "me.this-or-that.likes", method: "GET", path: "/api/me/this-or-that/likes", access: "me", rateLimit: "ip", query: idsQuery, handle: handleMyLikes }),
  route({ id: "write.this-or-that.like.put", method: "PUT", path: "/api/write/this-or-that/like", access: "write", rateLimit: "ip", query: idQuery, handle: (context: UserRouteContext) => handleLike(context, true) }),
  route({ id: "write.this-or-that.like.delete", method: "DELETE", path: "/api/write/this-or-that/like", access: "write", rateLimit: "ip", query: idQuery, handle: (context: UserRouteContext) => handleLike(context, false) }),
  route({ id: "read.this-or-that.vote-summaries", method: "GET", path: "/api/read/this-or-that/vote-summaries", access: "public", rateLimit: "ip", query: { ids: (value: string) => parsePostIds(value, THIS_OR_THAT_SUMMARY_IDS) !== null }, handle: handleVoteSummaries }),
  route({ id: "me.this-or-that.votes", method: "GET", path: "/api/me/this-or-that/votes", access: "me", rateLimit: "ip", query: idsQuery, handle: handleMyVotes }),
  route({ id: "write.this-or-that.vote.put", method: "PUT", path: "/api/write/this-or-that/vote", access: "write", rateLimit: "ip", query: idQuery, body: { maxBytes: 1024 }, handle: handleVote }),
  route({ id: "write.this-or-that.vote.delete", method: "DELETE", path: "/api/write/this-or-that/vote", access: "write", rateLimit: "ip", query: idQuery, handle: handleUnvote }),
];

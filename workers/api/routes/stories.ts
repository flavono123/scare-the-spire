import { isUuid } from "../../../src/lib/engagement-keys";
import { isStoryLimit, isStorySource, STORY_COLUMNS, storyInsertRow } from "../../../src/lib/stories-api-rules";
import { API_MARKER_HEADER, apiError, jsonResponse, PRIVATE_NO_STORE } from "../http";
import type { ApiRoute, PublicRouteContext, UserRouteContext } from "../router";
import { postgrest, postgrestStream } from "../supabase-rest";
import { HANDLER_BUDGET_MS, restErrorCode } from "./comments";

/**
 * The stories group (docs/supabase-exit/STEP1_DESIGN.md 9.7): the community
 * story feed, writing and deleting a story. The feed can be 1,000 rows with
 * tags and linked entities up to 128 KB each, so it is passed through unparsed
 * like the run lists (9.6). The api path opens no Realtime channel (section 14).
 */

const STREAM_READ_MS = 15_000;

async function handleFeed(context: PublicRouteContext): Promise<Response> {
  const limit = context.url.searchParams.get("limit") ?? "100";
  const source = context.url.searchParams.get("source");
  if (!isStoryLimit(limit) || (source !== null && !isStorySource(source))) return apiError("invalid");
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrestStream(config, {
    path: "community_stories",
    deadline: Date.now() + STREAM_READ_MS,
    timeoutMs: STREAM_READ_MS,
    query: new URLSearchParams({
      select: STORY_COLUMNS,
      env: `eq.${config.dataEnv}`,
      ...(source ? { source: `eq.${source}` } : {}),
      order: "created_at.desc",
      limit,
    }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  // PostgREST's array as is; no JS touches the body (CPU, see 9.6).
  return new Response(result.response.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": PRIVATE_NO_STORE,
      "X-Robots-Tag": "noindex",
      "X-Slseoun-Api-Env": config.dataEnv,
      [API_MARKER_HEADER]: "1",
    },
  });
}

async function handleCreate(context: UserRouteContext): Promise<Response> {
  const body = context.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("invalid");
  const row = storyInsertRow(body as Record<string, unknown>);
  if (!row) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrest<Record<string, unknown>[]>(config, {
    method: "POST",
    path: "community_stories",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ select: STORY_COLUMNS }),
    body: { ...row, user_id: user.userId, env: config.dataEnv },
    prefer: ["return=representation"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  const inserted = result.data?.[0];
  if (!inserted) return apiError("unavailable");
  return jsonResponse({ v: 1, env: config.dataEnv, row: inserted }, { status: 201 });
}

async function handleDelete(context: UserRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isUuid(id)) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrest<{ id: string }[]>(config, {
    method: "DELETE",
    path: "community_stories",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ id: `eq.${id.toLowerCase()}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}`, select: "id" }),
    prefer: ["return=representation"],
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, deleted: (result.data ?? []).length > 0 });
}

export const storiesRoutes: readonly ApiRoute[] = [
  {
    id: "read.stories",
    method: "GET",
    path: "/api/read/stories",
    group: "stories",
    access: "public",
    query: { limit: isStoryLimit, source: isStorySource },
    rateLimit: "ip",
    handle: handleFeed,
  },
  {
    id: "write.stories.create",
    method: "POST",
    path: "/api/write/stories",
    group: "stories",
    access: "write",
    query: {},
    body: { maxBytes: 160 * 1024 },
    handle: handleCreate,
  },
  {
    id: "write.stories.delete",
    method: "DELETE",
    path: "/api/write/stories",
    group: "stories",
    access: "write",
    query: { id: isUuid },
    handle: handleDelete,
  },
];

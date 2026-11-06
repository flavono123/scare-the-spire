import { isUuid, philosopherReplyThreadKey } from "../../../src/lib/engagement-keys";
import { kstWeekStart } from "../../../src/lib/nav-surfaces";
import { apiError, jsonResponse } from "../http";
import type { ApiRoute, PublicRouteContext } from "../router";
import { postgrest, type SupabaseApiConfig } from "../supabase-rest";
import { HANDLER_BUDGET_MS, restErrorCode } from "./comments";

/**
 * The colorful philosophers group (docs/supabase-exit/STEP1_DESIGN.md 9.2):
 * the weekly list, one post, and the shell patch reel. Posts are written only
 * by the admin page (service role); reactions and replies are the comments group.
 */

export const PHILOSOPHER_POST_COLUMNS =
  "id,week_start,slot,resource_type,resource_id,name_ko,name_en,image_url,body,game_version,buff_count,nerf_count,rework_count";
const REEL_COLUMNS = "id,week_start,slot,resource_type,resource_id,name_ko,name_en,image_url,body,game_version";
const WEEK_POST_LIMIT = 100;
const REEL_POST_LIMIT = 12;
/** Same cap as the legacy count query (use-colorful-philosopher-posts.ts). */
const COMMENT_COUNT_ROWS = 1000;

type PostRow = Record<string, unknown> & { id?: unknown; week_start?: unknown };

function weekOf(row: PostRow): string {
  return typeof row.week_start === "string" ? row.week_start.slice(0, 10) : "";
}

/** Reply counts for the posts the list shows (published by this KST week). */
async function replyCounts(config: SupabaseApiConfig, postIds: readonly string[], deadline: number) {
  if (postIds.length === 0) return { ok: true as const, data: {} as Record<string, number> };
  const keys = postIds.map(philosopherReplyThreadKey);
  const result = await postgrest<{ story_id: string }[]>(config, {
    path: "comments",
    deadline,
    query: new URLSearchParams({
      select: "story_id",
      env: `eq.${config.dataEnv}`,
      story_id: `in.(${keys.map((key) => `"${key}"`).join(",")})`,
      limit: String(COMMENT_COUNT_ROWS),
    }),
  });
  if (!result.ok) return result;
  const counts: Record<string, number> = {};
  const prefix = philosopherReplyThreadKey("");
  for (const row of result.data ?? []) {
    const id = String(row.story_id ?? "").slice(prefix.length);
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return { ok: true as const, data: counts };
}

async function handleWeek(context: PublicRouteContext): Promise<Response> {
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: context.config.dataEnv });
  const { config } = context;
  const deadline = Date.now() + HANDLER_BUDGET_MS;
  const posts = await postgrest<PostRow[]>(config, {
    path: "colorful_philosopher_posts",
    deadline,
    query: new URLSearchParams({
      select: PHILOSOPHER_POST_COLUMNS,
      env: `eq.${config.dataEnv}`,
      order: "week_start.desc",
      limit: String(WEEK_POST_LIMIT),
    }),
  });
  if (!posts.ok) return apiError(restErrorCode(posts));
  const rows = posts.data ?? [];
  const currentWeek = kstWeekStart(new Date(context.now));
  const shown = rows
    .filter((row) => typeof row.id === "string" && isUuid(row.id) && weekOf(row) && weekOf(row) <= currentWeek)
    .map((row) => String(row.id));
  const counts = await replyCounts(config, shown, deadline);
  // Counts failing leaves them out; the list then shows no reply numbers, like the legacy query.
  return jsonResponse({ v: 1, env: config.dataEnv, posts: rows, ...(counts.ok ? { commentCounts: counts.data } : {}) });
}

async function handlePost(context: PublicRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isUuid(id)) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: context.config.dataEnv });
  const { config } = context;
  const result = await postgrest<PostRow[]>(config, {
    path: "colorful_philosopher_posts",
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({
      select: PHILOSOPHER_POST_COLUMNS,
      env: `eq.${config.dataEnv}`,
      id: `eq.${id.toLowerCase()}`,
      limit: "1",
    }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, post: result.data?.[0] ?? null });
}

async function handleReel(context: PublicRouteContext): Promise<Response> {
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: context.config.dataEnv });
  const { config } = context;
  const result = await postgrest<PostRow[]>(config, {
    path: "colorful_philosopher_posts",
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({
      select: REEL_COLUMNS,
      env: `eq.${config.dataEnv}`,
      week_start: `lte.${kstWeekStart(new Date(context.now))}`,
      order: "week_start.desc",
      limit: String(REEL_POST_LIMIT),
    }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, posts: result.data ?? [] });
}

export const colorfulPhilosophersRoutes: readonly ApiRoute[] = [
  {
    id: "read.colorful-philosophers.week",
    method: "GET",
    path: "/api/read/colorful-philosophers/week",
    group: "colorful-philosophers",
    access: "public",
    query: {},
    rateLimit: "ip",
    handle: handleWeek,
  },
  {
    id: "read.colorful-philosophers.post",
    method: "GET",
    path: "/api/read/colorful-philosophers/post",
    group: "colorful-philosophers",
    access: "public",
    query: { id: (value: string) => isUuid(value) },
    rateLimit: "ip",
    handle: handlePost,
  },
  {
    id: "read.colorful-philosophers.reel",
    method: "GET",
    path: "/api/read/colorful-philosophers/reel",
    group: "colorful-philosophers",
    access: "public",
    query: {},
    rateLimit: "ip",
    handle: handleReel,
  },
];

import {
  CONTACT_INQUIRY_HISTORY_COLUMNS,
  CONTACT_INQUIRY_HISTORY_COLUMNS_LEGACY,
  CONTACT_INQUIRY_HISTORY_LIMIT,
  isProfileActivityFilter,
  isProfileActivityOffset,
  isProfileActivitySort,
  PROFILE_ACTIVITY_PAGE_SIZE,
} from "../../../src/lib/profile-activity-rules";
import { apiError, jsonResponse } from "../http";
import type { ApiRoute, PublicRouteContext, UserRouteContext } from "../router";
import { postgrest } from "../supabase-rest";
import { HANDLER_BUDGET_MS, restErrorCode } from "./comments";

/**
 * The profile group (docs/supabase-exit/STEP1_DESIGN.md 9.4): nickname pools,
 * activity stats and pages (RPCs that read auth.uid()), the user's inquiries,
 * and marking replies seen. Everything but the nickname pools needs a session.
 */

/** Errors meaning a table or column is not deployed yet (as the legacy readers treat them). */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

async function handleNicknames(context: PublicRouteContext): Promise<Response> {
  const { config } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  // No env column: one shared set of pools (10 rows or fewer).
  const result = await postgrest<unknown[]>(config, {
    path: "profile_character_nickname_pools",
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({ select: "character_id,locale,nicknames" }),
  });
  if (!result.ok) {
    if (MISSING_TABLE.has(result.code)) return jsonResponse({ v: 1, env: config.dataEnv, rows: null });
    return apiError(restErrorCode(result));
  }
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

async function handleStats(context: UserRouteContext): Promise<Response> {
  const { config, token } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrest<unknown[]>(config, {
    method: "POST",
    path: "rpc/get_my_profile_activity_stats",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: { p_env: config.dataEnv },
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

async function handleActivity(context: UserRouteContext): Promise<Response> {
  const { config, token, url } = context;
  const category = url.searchParams.get("category") ?? "all";
  const sort = url.searchParams.get("sort") ?? "latest";
  const offset = url.searchParams.get("offset") ?? "0";
  if (!isProfileActivityFilter(category) || !isProfileActivitySort(sort) || !isProfileActivityOffset(offset)) {
    return apiError("invalid");
  }
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrest<unknown[]>(config, {
    method: "POST",
    path: "rpc/get_my_profile_activity",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: {
      p_env: config.dataEnv,
      p_category: category,
      p_sort: sort,
      p_limit: PROFILE_ACTIVITY_PAGE_SIZE,
      p_offset: Number(offset),
    },
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [] });
}

async function handleInquiries(context: UserRouteContext): Promise<Response> {
  const { config, token } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const deadline = Date.now() + HANDLER_BUDGET_MS;
  const read = (select: string) => postgrest<unknown[]>(config, {
    path: "contact_inquiries",
    token,
    deadline,
    // RLS shows only the caller's rows. This env only, like every Worker query (section 5).
    query: new URLSearchParams({
      select,
      env: `eq.${config.dataEnv}`,
      order: "created_at.desc",
      limit: String(CONTACT_INQUIRY_HISTORY_LIMIT),
    }),
  });
  let result = await read(CONTACT_INQUIRY_HISTORY_COLUMNS);
  let replySeenColumn = true;
  if (!result.ok && MISSING_COLUMN.has(result.code)) {
    replySeenColumn = false;
    result = await read(CONTACT_INQUIRY_HISTORY_COLUMNS_LEGACY);
  }
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, rows: result.data ?? [], replySeenColumn });
}

async function handleInquiriesSeen(context: UserRouteContext): Promise<Response> {
  const { config, token } = context;
  // Only reply_seen_at may be updated by users (schema:5889); the time is the Worker's.
  const result = await postgrest<null>(config, {
    method: "PATCH",
    path: "contact_inquiries",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({
      env: `eq.${config.dataEnv}`,
      admin_response: "not.is.null",
      reply_seen_at: "is.null",
    }),
    body: { reply_seen_at: new Date(context.now).toISOString() },
    prefer: ["return=minimal"],
  });
  if (!result.ok && !MISSING_COLUMN.has(result.code)) return apiError(restErrorCode(result));
  return jsonResponse({});
}

export const profileRoutes: readonly ApiRoute[] = [
  {
    id: "read.profile.nicknames",
    method: "GET",
    path: "/api/read/profile/nicknames",
    group: "profile",
    access: "public",
    query: {},
    rateLimit: "ip",
    handle: handleNicknames,
  },
  {
    id: "me.profile.stats",
    method: "GET",
    path: "/api/me/profile/stats",
    group: "profile",
    access: "me",
    query: {},
    handle: handleStats,
  },
  {
    id: "me.profile.activity",
    method: "GET",
    path: "/api/me/profile/activity",
    group: "profile",
    access: "me",
    query: { category: isProfileActivityFilter, sort: isProfileActivitySort, offset: isProfileActivityOffset },
    handle: handleActivity,
  },
  {
    id: "me.profile.inquiries",
    method: "GET",
    path: "/api/me/profile/inquiries",
    group: "profile",
    access: "me",
    query: {},
    handle: handleInquiries,
  },
  {
    id: "write.profile.inquiries-seen",
    method: "POST",
    path: "/api/write/profile/inquiries-seen",
    group: "profile",
    access: "write",
    query: {},
    handle: handleInquiriesSeen,
  },
];

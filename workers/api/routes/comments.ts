import {
  ENGAGEMENT_ME_PARTS,
  ENGAGEMENT_PARTS,
  ENGAGEMENT_QUERY_MAX_CHARS,
  isReactionKind,
  isReactionTarget,
  isThreadKey,
  isUuid,
  parseEngagementList,
  parsePhilosopherResourceKey,
  parseReactionTargetKey,
  philosopherReplyThreadKey,
  PHILOSOPHER_POSTS_PER_RESOURCE,
  reactionTargetKey,
  type EngagementPart,
  type ReactionCounts,
  type ReactionKind,
  type ReactionTarget,
} from "../../../src/lib/engagement-keys";
import { apiError, jsonResponse, type ApiErrorCode } from "../http";
import type { ApiRoute, PublicRouteContext, UserRouteContext } from "../router";
import {
  inWaves,
  isUpstreamFailure,
  postgrest,
  type RestFailure,
  type RestResult,
  type SupabaseApiConfig,
} from "../supabase-rest";

/**
 * The comments group (docs/supabase-exit/STEP1_DESIGN.md 9.1): one coalesced
 * public read, a personal overlay, and the comment, like and reaction writes.
 * Supabase stays the source and there is no cache: a writer reloading must
 * see their own comment.
 */

export const COMMENT_COLUMNS =
  "id,story_id,user_id,nickname,content,content_blocks,created_at,avatar_id,avatar_kind,palette_id,palette_swapped";
const PHILOSOPHER_COLUMNS =
  "id,week_start,slot,resource_type,resource_id,name_ko,name_en,image_url,body,game_version,buff_count,nerf_count,rework_count";
const REACTION_COUNT_COLUMNS = "resource_type,resource_id,game_version,buff_count,nerf_count,rework_count";
/** One batch never returns more comment rows than this; a full batch is reported unavailable, never cut silently. */
export const THREAD_ROW_LIMIT = 1000;
export const WRITE_BODY_MAX_BYTES = 160 * 1024;
const CONTENT_BLOCKS_MAX_BYTES = 128 * 1024;
const AUTHOR_FIELD_MAX = 128;

export type CommentRow = {
  id: string;
  story_id: string;
  user_id: string;
  nickname: string;
  content: string;
  content_blocks: unknown;
  created_at: string | null;
  avatar_id: string | null;
  avatar_kind: string | null;
  palette_id: string | null;
  palette_swapped: boolean | null;
  like_count: number;
};

type RawCommentRow = Omit<CommentRow, "like_count"> & { comment_likes?: { count?: number }[] };

type ReactionCountRow = {
  resource_type: string;
  resource_id: string;
  game_version: string;
  buff_count: number | null;
  nerf_count: number | null;
  rework_count: number | null;
};

type PhilosopherRow = Record<string, unknown> & {
  id?: unknown;
  slot?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  game_version?: unknown;
};

/** `in.("a","b")`. Every key and id passed here matches a charset without quotes, commas or backslashes. */
function inList(values: readonly string[]): string {
  return `in.(${values.map((value) => `"${value}"`).join(",")})`;
}

function zeroCounts(): ReactionCounts {
  return { buff: 0, nerf: 0, rework: 0 };
}

function countsFromRow(row: Partial<ReactionCountRow> | null | undefined): ReactionCounts {
  return {
    buff: typeof row?.buff_count === "number" ? row.buff_count : 0,
    nerf: typeof row?.nerf_count === "number" ? row.nerf_count : 0,
    rework: typeof row?.rework_count === "number" ? row.rework_count : 0,
  };
}

/** The total of a `count=exact` answer (`0-4/5` or `*\/0`). */
export function contentRangeTotal(contentRange: string | null): number | null {
  const match = /\/(\d+)$/.exec(contentRange ?? "");
  return match ? Number(match[1]) : null;
}

/** Maps a PostgREST failure to the API error contract (STEP1_DESIGN 4.2). */
export function restErrorCode(result: RestFailure): ApiErrorCode {
  if (isUpstreamFailure(result) || result.code === "timeout" || result.code === "network") return "unavailable";
  // RLS refusals are 42501 (HTTP 401 for anon, 403 for authenticated); check the code first.
  if (result.code === "42501" || result.status === 403) return "forbidden";
  if (result.status === 401 || result.code.startsWith("PGRST30")) return "token_expired";
  if (result.code === "23514") return "check_violation";
  if (result.code === "23505") return "duplicate";
  if (result.code === "23503") return "not_found";
  return "invalid";
}

function restError(result: RestFailure): Response {
  return apiError(restErrorCode(result));
}

// --- Public read ---------------------------------------------------------------

type EngagementRequest = Partial<Record<EngagementPart, string[]>>;

function parseEngagementQuery(url: URL, parts: readonly EngagementPart[]): EngagementRequest | null {
  if (url.search.length > ENGAGEMENT_QUERY_MAX_CHARS) return null;
  const request: EngagementRequest = {};
  let any = false;
  for (const part of parts) {
    const raw = url.searchParams.get(part);
    if (raw === null) continue;
    const list = parseEngagementList(part, raw);
    if (!list) return null;
    request[part] = list;
    any = true;
  }
  return any ? request : null;
}

function engagementQuerySchema(parts: readonly EngagementPart[]) {
  return Object.fromEntries(parts.map((part) => [part, (value: string) => parseEngagementList(part, value) !== null]));
}

async function readThreads(config: SupabaseApiConfig, keys: readonly string[]): Promise<RestResult<RawCommentRow[]>> {
  return postgrest<RawCommentRow[]>(config, {
    path: "comments",
    query: new URLSearchParams({
      select: `${COMMENT_COLUMNS},comment_likes(count)`,
      env: `eq.${config.dataEnv}`,
      story_id: inList(keys),
      order: "created_at.asc",
      limit: String(THREAD_ROW_LIMIT),
    }),
  });
}

export function commentFromRow(row: RawCommentRow): CommentRow {
  const { comment_likes: likes, ...rest } = row;
  const count = Array.isArray(likes) && typeof likes[0]?.count === "number" ? likes[0].count : 0;
  return { ...rest, like_count: count };
}

function groupThreads(keys: readonly string[], rows: readonly RawCommentRow[]): Record<string, CommentRow[]> {
  const threads: Record<string, CommentRow[]> = Object.fromEntries(keys.map((key) => [key, [] as CommentRow[]]));
  for (const row of rows) threads[row.story_id]?.push(commentFromRow(row));
  return threads;
}

async function readLikeCount(config: SupabaseApiConfig, key: string): Promise<RestResult<number>> {
  const result = await postgrest<null>(config, {
    method: "HEAD",
    path: "likes",
    query: new URLSearchParams({ select: "id", story_id: `eq.${key}`, env: `eq.${config.dataEnv}` }),
    prefer: ["count=exact"],
  });
  if (!result.ok) return result;
  const total = contentRangeTotal(result.contentRange);
  return total === null ? { ok: false, status: result.status, code: "bad_response" } : { ...result, data: total };
}

async function readReactionCounts(
  config: SupabaseApiConfig,
  targets: readonly ReactionTarget[],
): Promise<RestResult<Record<string, ReactionCounts>>> {
  const ids = [...new Set(targets.map((target) => target.resourceId))];
  const result = await postgrest<ReactionCountRow[]>(config, {
    path: "resource_reaction_counts",
    query: new URLSearchParams({ select: REACTION_COUNT_COLUMNS, env: `eq.${config.dataEnv}`, resource_id: inList(ids) }),
  });
  if (!result.ok) return result;
  const counts: Record<string, ReactionCounts> = Object.fromEntries(targets.map((target) => [reactionTargetKey(target), zeroCounts()]));
  for (const row of result.data ?? []) {
    const key = reactionTargetKey({ resourceType: String(row.resource_type), resourceId: String(row.resource_id), gameVersion: String(row.game_version) });
    if (key in counts) counts[key] = countsFromRow(row);
  }
  return { ...result, data: counts };
}

async function readPhilosophers(config: SupabaseApiConfig, resourceKey: string): Promise<RestResult<PhilosopherRow[]>> {
  const resource = parsePhilosopherResourceKey(resourceKey);
  if (!resource) return { ok: false, status: 400, code: "invalid" };
  return postgrest<PhilosopherRow[]>(config, {
    path: "colorful_philosopher_posts",
    query: new URLSearchParams({
      select: PHILOSOPHER_COLUMNS,
      env: `eq.${config.dataEnv}`,
      resource_type: `eq.${resource.resourceType}`,
      resource_id: `eq.${resource.resourceId}`,
      order: "week_start.desc",
      limit: String(PHILOSOPHER_POSTS_PER_RESOURCE),
    }),
  });
}

/** The reply thread and reaction target each philosopher post's widgets read (resource-thread.tsx). */
function philosopherExtras(rows: readonly PhilosopherRow[]): { threads: string[]; reactions: ReactionTarget[] } {
  const threads: string[] = [];
  const reactions: ReactionTarget[] = [];
  for (const row of rows) {
    if (typeof row.id === "string" && row.id) {
      const key = philosopherReplyThreadKey(row.id);
      if (isThreadKey(key)) threads.push(key);
    }
    // Same fallback as colorfulPhilosopherPostFromRow: an empty resource_type means the slot.
    const resourceType = typeof row.resource_type === "string" && row.resource_type ? row.resource_type : row.slot;
    const target = { resourceType: String(resourceType ?? ""), resourceId: String(row.resource_id ?? ""), gameVersion: String(row.game_version ?? "") };
    if (isReactionTarget(target)) reactions.push(target);
  }
  return { threads, reactions };
}

export type EngagementBody = {
  v: 1;
  env: string;
  threads?: Record<string, CommentRow[]>;
  likes?: Record<string, number>;
  reactions?: Record<string, ReactionCounts>;
  philosophers?: Record<string, PhilosopherRow[]>;
  unavailable?: EngagementPart[];
};

async function handleEngagement(context: PublicRouteContext): Promise<Response> {
  const wanted = parseEngagementQuery(context.url, ENGAGEMENT_PARTS);
  if (!wanted) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: context.config.dataEnv });
  const { config } = context;
  const body: EngagementBody = { v: 1, env: config.dataEnv };
  const unavailable = new Set<EngagementPart>();

  const threadKeys = wanted.threads ?? [];
  const likeKeys = wanted.likes ?? [];
  const targets = (wanted.reactions ?? []).map((key) => parseReactionTargetKey(key) as ReactionTarget);
  const resources = wanted.philosophers ?? [];

  const tasks: (() => Promise<void>)[] = [];
  if (threadKeys.length) {
    tasks.push(async () => {
      const result = await readThreads(config, threadKeys);
      if (!result.ok || (result.data ?? []).length >= THREAD_ROW_LIMIT) unavailable.add("threads");
      else body.threads = groupThreads(threadKeys, result.data ?? []);
    });
  }
  if (targets.length) {
    tasks.push(async () => {
      const result = await readReactionCounts(config, targets);
      if (result.ok) body.reactions = result.data;
      else unavailable.add("reactions");
    });
  }
  const philosopherRows: Record<string, PhilosopherRow[]> = {};
  for (const resource of resources) {
    tasks.push(async () => {
      const result = await readPhilosophers(config, resource);
      if (result.ok) philosopherRows[resource] = result.data ?? [];
      else unavailable.add("philosophers");
    });
  }
  const likes: Record<string, number> = {};
  for (const key of likeKeys) {
    tasks.push(async () => {
      const result = await readLikeCount(config, key);
      if (result.ok) likes[key] = result.data;
      else unavailable.add("likes");
    });
  }
  await inWaves(tasks);
  if (likeKeys.length && !unavailable.has("likes")) body.likes = likes;
  if (resources.length && !unavailable.has("philosophers")) {
    body.philosophers = philosopherRows;

    // Second wave: reply threads and reaction totals the posts' widgets will ask for.
    const extras = philosopherExtras(Object.values(philosopherRows).flat());
    const extraThreads = extras.threads.filter((key) => !(body.threads && key in body.threads));
    const extraTargets = extras.reactions.filter((target) => !(body.reactions && reactionTargetKey(target) in body.reactions));
    const uniqueTargets = [...new Map(extraTargets.map((target) => [reactionTargetKey(target), target])).values()];
    const second: (() => Promise<void>)[] = [];
    // A failed extra is left out; the widget then asks for it on its own.
    if (extraThreads.length) {
      second.push(async () => {
        const result = await readThreads(config, extraThreads);
        if (result.ok && (result.data ?? []).length < THREAD_ROW_LIMIT) {
          body.threads = { ...body.threads, ...groupThreads(extraThreads, result.data ?? []) };
        }
      });
    }
    if (uniqueTargets.length) {
      second.push(async () => {
        const result = await readReactionCounts(config, uniqueTargets);
        if (result.ok) body.reactions = { ...body.reactions, ...result.data };
      });
    }
    await inWaves(second);
  }

  const requested = ENGAGEMENT_PARTS.filter((part) => wanted[part]?.length);
  if (requested.every((part) => unavailable.has(part))) return apiError("unavailable");
  if (unavailable.size) body.unavailable = [...unavailable];
  return jsonResponse(body);
}

// --- Personal overlay -------------------------------------------------------------

export type EngagementMeBody = {
  v: 1;
  env: string;
  commentLikes?: Record<string, string[]>;
  likes?: Record<string, boolean>;
  reactions?: Record<string, ReactionKind | null>;
  unavailable?: EngagementPart[];
};

async function handleEngagementMe(context: UserRouteContext): Promise<Response> {
  const wanted = parseEngagementQuery(context.url, ENGAGEMENT_ME_PARTS);
  if (!wanted) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: context.config.dataEnv });
  const { config, token, user } = context;
  const body: EngagementMeBody = { v: 1, env: config.dataEnv };
  const unavailable = new Set<EngagementPart>();
  const tasks: (() => Promise<void>)[] = [];

  const threadKeys = wanted.threads ?? [];
  if (threadKeys.length) {
    tasks.push(async () => {
      const result = await postgrest<{ comment_id: string; comments: { story_id: string } | null }[]>(config, {
        path: "comment_likes",
        token,
        query: new URLSearchParams({
          select: "comment_id,comments!inner(story_id)",
          user_id: `eq.${user.userId}`,
          "comments.story_id": inList(threadKeys),
          "comments.env": `eq.${config.dataEnv}`,
          limit: String(THREAD_ROW_LIMIT),
        }),
      });
      if (!result.ok || (result.data ?? []).length >= THREAD_ROW_LIMIT) {
        unavailable.add("threads");
        return;
      }
      const liked: Record<string, string[]> = Object.fromEntries(threadKeys.map((key) => [key, [] as string[]]));
      for (const row of result.data ?? []) {
        const key = row.comments?.story_id;
        if (key && liked[key]) liked[key].push(String(row.comment_id));
      }
      body.commentLikes = liked;
    });
  }

  const likeKeys = wanted.likes ?? [];
  if (likeKeys.length) {
    tasks.push(async () => {
      const result = await postgrest<{ story_id: string }[]>(config, {
        path: "likes",
        token,
        query: new URLSearchParams({
          select: "story_id",
          user_id: `eq.${user.userId}`,
          env: `eq.${config.dataEnv}`,
          story_id: inList(likeKeys),
        }),
      });
      if (!result.ok) {
        unavailable.add("likes");
        return;
      }
      const mine = new Set((result.data ?? []).map((row) => row.story_id));
      body.likes = Object.fromEntries(likeKeys.map((key) => [key, mine.has(key)]));
    });
  }

  const targets = (wanted.reactions ?? []).map((key) => parseReactionTargetKey(key) as ReactionTarget);
  if (targets.length) {
    tasks.push(async () => {
      const ids = [...new Set(targets.map((target) => target.resourceId))];
      const result = await postgrest<{ resource_type: string; resource_id: string; game_version: string; kind: string }[]>(config, {
        path: "resource_reactions",
        token,
        query: new URLSearchParams({
          select: "resource_type,resource_id,game_version,kind",
          user_id: `eq.${user.userId}`,
          env: `eq.${config.dataEnv}`,
          resource_id: inList(ids),
        }),
      });
      if (!result.ok) {
        unavailable.add("reactions");
        return;
      }
      const kinds: Record<string, ReactionKind | null> = Object.fromEntries(targets.map((target) => [reactionTargetKey(target), null]));
      for (const row of result.data ?? []) {
        const key = reactionTargetKey({ resourceType: row.resource_type, resourceId: row.resource_id, gameVersion: row.game_version });
        if (key in kinds && isReactionKind(row.kind)) kinds[key] = row.kind;
      }
      body.reactions = kinds;
    });
  }

  await inWaves(tasks);
  const requested = ENGAGEMENT_ME_PARTS.filter((part) => wanted[part]?.length);
  if (requested.every((part) => unavailable.has(part))) return apiError("unavailable");
  if (unavailable.size) body.unavailable = [...unavailable];
  return jsonResponse(body);
}

// --- Writes -------------------------------------------------------------------

type AuthorFields = { avatar_id?: string | null; avatar_kind?: string | null; palette_id?: string | null; palette_swapped?: boolean | null };

function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value as null | undefined;
  return typeof value === "string" && value.length <= AUTHOR_FIELD_MAX ? value : undefined;
}

/** Validates the author token; null when it is malformed. */
export function parseAuthor(value: unknown): AuthorFields | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const author = value as Record<string, unknown>;
  const fields: AuthorFields = {};
  for (const [from, to] of [["avatarId", "avatar_id"], ["avatarKind", "avatar_kind"], ["paletteId", "palette_id"]] as const) {
    const text = optionalText(author[from]);
    if (text === undefined && author[from] !== undefined) return null;
    if (author[from] !== undefined) fields[to] = text;
  }
  const swapped = author.paletteSwapped;
  if (swapped !== undefined) {
    if (swapped !== null && typeof swapped !== "boolean") return null;
    fields.palette_swapped = swapped;
  }
  return fields;
}

export type CommentInput = {
  story_id: string;
  nickname: string;
  content: string;
  content_blocks: unknown[] | null;
} & AuthorFields;

/** Mirrors the client checks and the table's CHECK constraints (schema:2693-2698). */
export function parseCommentInput(value: unknown): CommentInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.threadKey !== "string" || !isThreadKey(input.threadKey)) return null;
  if (typeof input.nickname !== "string") return null;
  const nickname = input.nickname.trim();
  const nicknameLength = Array.from(nickname).length;
  if (nicknameLength < 1 || nicknameLength > 20) return null;
  if (typeof input.content !== "string") return null;
  const content = input.content;
  if (content.trim().length < 2 || Array.from(content).length > 2000) return null;
  let blocks: unknown[] | null = null;
  if (input.contentBlocks !== undefined && input.contentBlocks !== null) {
    if (!Array.isArray(input.contentBlocks)) return null;
    if (new TextEncoder().encode(JSON.stringify(input.contentBlocks)).byteLength > CONTENT_BLOCKS_MAX_BYTES) return null;
    blocks = input.contentBlocks;
  }
  const author = parseAuthor(input.author);
  if (!author) return null;
  return { story_id: input.threadKey, nickname, content, content_blocks: blocks, ...author };
}

async function handleCreateComment(context: UserRouteContext): Promise<Response> {
  const input = parseCommentInput(context.body);
  if (!input) return apiError("invalid");
  const { config, token, user } = context;
  const result = await postgrest<Omit<CommentRow, "like_count">[]>(config, {
    method: "POST",
    path: "comments",
    token,
    query: new URLSearchParams({ select: COMMENT_COLUMNS }),
    prefer: ["return=representation"],
    body: { ...input, user_id: user.userId, env: config.dataEnv },
  });
  if (!result.ok) return restError(result);
  const row = result.data?.[0];
  if (!row) return apiError("unavailable");
  return jsonResponse({ comment: { ...row, like_count: 0 } }, { status: 201 });
}

async function handleDeleteComment(context: UserRouteContext): Promise<Response> {
  const id = context.url.searchParams.get("id") ?? "";
  const { config, token, user } = context;
  const result = await postgrest<{ id: string }[]>(config, {
    method: "DELETE",
    path: "comments",
    token,
    query: new URLSearchParams({ id: `eq.${id.toLowerCase()}`, user_id: `eq.${user.userId}`, select: "id" }),
    prefer: ["return=representation"],
  });
  if (!result.ok) return restError(result);
  if (!result.data?.length) return apiError("not_found");
  return jsonResponse({ deleted: true });
}

async function exactCount(config: SupabaseApiConfig, table: string, query: Record<string, string>): Promise<RestResult<number>> {
  const result = await postgrest<null>(config, {
    method: "HEAD",
    path: table,
    query: new URLSearchParams(query),
    prefer: ["count=exact"],
  });
  if (!result.ok) return result;
  const total = contentRangeTotal(result.contentRange);
  return total === null ? { ok: false, status: result.status, code: "bad_response" } : { ...result, data: total };
}

/** Insert that treats "already there" (23505) as done; PUT is idempotent. */
async function insertIgnoringDuplicate(config: SupabaseApiConfig, token: string, path: string, body: unknown): Promise<RestFailure | null> {
  const result = await postgrest<null>(config, { method: "POST", path, token, body, prefer: ["return=minimal"] });
  if (result.ok || result.code === "23505") return null;
  return result;
}

async function handleCommentLike(context: UserRouteContext, like: boolean): Promise<Response> {
  const id = (context.url.searchParams.get("id") ?? "").toLowerCase();
  const { config, token, user } = context;
  if (like) {
    const failure = await insertIgnoringDuplicate(config, token, "comment_likes", { comment_id: id, user_id: user.userId });
    if (failure) return restError(failure);
  } else {
    const result = await postgrest<null>(config, {
      method: "DELETE",
      path: "comment_likes",
      token,
      query: new URLSearchParams({ comment_id: `eq.${id}`, user_id: `eq.${user.userId}` }),
      prefer: ["return=minimal"],
    });
    if (!result.ok) return restError(result);
  }
  const count = await exactCount(config, "comment_likes", { select: "id", comment_id: `eq.${id}` });
  if (!count.ok) return restError(count);
  return jsonResponse({ liked: like, count: count.data });
}

async function handleLike(context: UserRouteContext, like: boolean): Promise<Response> {
  const key = context.url.searchParams.get("key") ?? "";
  const { config, token, user } = context;
  if (like) {
    const failure = await insertIgnoringDuplicate(config, token, "likes", { story_id: key, user_id: user.userId, env: config.dataEnv });
    if (failure) return restError(failure);
  } else {
    const result = await postgrest<null>(config, {
      method: "DELETE",
      path: "likes",
      token,
      query: new URLSearchParams({ story_id: `eq.${key}`, user_id: `eq.${user.userId}`, env: `eq.${config.dataEnv}` }),
      prefer: ["return=minimal"],
    });
    if (!result.ok) return restError(result);
  }
  const count = await exactCount(config, "likes", { select: "id", story_id: `eq.${key}`, env: `eq.${config.dataEnv}` });
  if (!count.ok) return restError(count);
  return jsonResponse({ liked: like, count: count.data });
}

export type ReactionInput = ReactionTarget & { kind: ReactionKind | null };

export function parseReactionInput(value: unknown): ReactionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const target = {
    resourceType: typeof input.resourceType === "string" ? input.resourceType : "",
    resourceId: typeof input.resourceId === "string" ? input.resourceId : "",
    gameVersion: typeof input.gameVersion === "string" ? input.gameVersion : "",
  };
  if (!isReactionTarget(target)) return null;
  if (input.kind !== null && !isReactionKind(input.kind)) return null;
  return { ...target, kind: input.kind as ReactionKind | null };
}

async function handleReaction(context: UserRouteContext): Promise<Response> {
  const input = parseReactionInput(context.body);
  if (!input) return apiError("invalid");
  const { config, token, user } = context;
  const match = {
    env: `eq.${config.dataEnv}`,
    resource_type: `eq.${input.resourceType}`,
    resource_id: `eq.${input.resourceId}`,
    game_version: `eq.${input.gameVersion}`,
    user_id: `eq.${user.userId}`,
  };
  const update = () => postgrest<{ kind: string }[]>(config, {
    method: "PATCH",
    path: "resource_reactions",
    token,
    query: new URLSearchParams({ ...match, select: "kind" }),
    body: { kind: input.kind },
    prefer: ["return=representation"],
  });

  if (input.kind === null) {
    const result = await postgrest<null>(config, {
      method: "DELETE",
      path: "resource_reactions",
      token,
      query: new URLSearchParams(match),
      prefer: ["return=minimal"],
    });
    if (!result.ok) return restError(result);
  } else {
    // The kind column is the only one users may update (schema:6064), so no upsert:
    // update, insert when there was no row, and update again if another tab inserted first.
    let result = await update();
    if (!result.ok) return restError(result);
    if (!result.data?.length) {
      const inserted = await postgrest<null>(config, {
        method: "POST",
        path: "resource_reactions",
        token,
        body: {
          env: config.dataEnv,
          resource_type: input.resourceType,
          resource_id: input.resourceId,
          game_version: input.gameVersion,
          user_id: user.userId,
          kind: input.kind,
        },
        prefer: ["return=minimal"],
      });
      if (!inserted.ok && inserted.code !== "23505") return restError(inserted);
      if (!inserted.ok) {
        result = await update();
        if (!result.ok) return restError(result);
      }
    }
  }

  const counts = await postgrest<ReactionCountRow[]>(config, {
    path: "resource_reaction_counts",
    query: new URLSearchParams({
      select: "buff_count,nerf_count,rework_count",
      env: match.env,
      resource_type: match.resource_type,
      resource_id: match.resource_id,
      game_version: match.game_version,
    }),
  });
  if (!counts.ok) return restError(counts);
  return jsonResponse({ kind: input.kind, counts: countsFromRow(counts.data?.[0]) });
}

// --- Engagement counts ---------------------------------------------------------------

async function handleEngagementCounts(context: PublicRouteContext): Promise<Response> {
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: context.config.dataEnv });
  const { config } = context;
  const result = await postgrest<{ story_id: string; like_count: number; comment_count: number }[]>(config, {
    method: "POST",
    path: "rpc/get_engagement_counts",
    body: { p_env: config.dataEnv },
  });
  if (!result.ok) return restError(result);
  const likes: Record<string, number> = {};
  const comments: Record<string, number> = {};
  for (const row of result.data ?? []) {
    if (row.like_count) likes[row.story_id] = row.like_count;
    if (row.comment_count) comments[row.story_id] = row.comment_count;
  }
  return jsonResponse({ v: 1, env: config.dataEnv, likes, comments });
}

// --- Routes ----------------------------------------------------------------------

const idQuery = { id: (value: string) => isUuid(value) };
const keyQuery = { key: (value: string) => isThreadKey(value) };

export function requireQuery(names: readonly string[]) {
  return (url: URL) => names.every((name) => url.searchParams.has(name));
}

function withRequired(names: readonly string[], handle: (context: UserRouteContext) => Promise<Response>) {
  const has = requireQuery(names);
  return (context: UserRouteContext) => (has(context.url) ? handle(context) : Promise.resolve(apiError("invalid")));
}

export const commentsRoutes: readonly ApiRoute[] = [
  {
    id: "read.engagement",
    method: "GET",
    path: "/api/read/engagement",
    group: "comments",
    access: "public",
    query: engagementQuerySchema(ENGAGEMENT_PARTS),
    rateLimit: "ip",
    handle: handleEngagement,
  },
  {
    id: "read.engagement-counts",
    method: "GET",
    path: "/api/read/engagement-counts",
    group: "comments",
    access: "public",
    query: {},
    rateLimit: "ip",
    handle: handleEngagementCounts,
  },
  {
    id: "me.engagement",
    method: "GET",
    path: "/api/me/engagement",
    group: "comments",
    access: "me",
    query: engagementQuerySchema(ENGAGEMENT_ME_PARTS),
    handle: handleEngagementMe,
  },
  {
    id: "write.comments.create",
    method: "POST",
    path: "/api/write/comments",
    group: "comments",
    access: "write",
    query: {},
    body: { maxBytes: WRITE_BODY_MAX_BYTES },
    handle: handleCreateComment,
  },
  {
    id: "write.comments.delete",
    method: "DELETE",
    path: "/api/write/comments",
    group: "comments",
    access: "write",
    query: idQuery,
    handle: withRequired(["id"], handleDeleteComment),
  },
  {
    id: "write.comment-likes.put",
    method: "PUT",
    path: "/api/write/comment-likes",
    group: "comments",
    access: "write",
    query: idQuery,
    handle: withRequired(["id"], (context) => handleCommentLike(context, true)),
  },
  {
    id: "write.comment-likes.delete",
    method: "DELETE",
    path: "/api/write/comment-likes",
    group: "comments",
    access: "write",
    query: idQuery,
    handle: withRequired(["id"], (context) => handleCommentLike(context, false)),
  },
  {
    id: "write.likes.put",
    method: "PUT",
    path: "/api/write/likes",
    group: "comments",
    access: "write",
    query: keyQuery,
    handle: withRequired(["key"], (context) => handleLike(context, true)),
  },
  {
    id: "write.likes.delete",
    method: "DELETE",
    path: "/api/write/likes",
    group: "comments",
    access: "write",
    query: keyQuery,
    handle: withRequired(["key"], (context) => handleLike(context, false)),
  },
  {
    id: "write.reactions",
    method: "PUT",
    path: "/api/write/reactions",
    group: "comments",
    access: "write",
    query: {},
    body: { maxBytes: 4096 },
    handle: handleReaction,
  },
];

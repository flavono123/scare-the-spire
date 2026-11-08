import {
  ENGAGEMENT_ME_PARTS,
  ENGAGEMENT_PARTS,
  isReactionKind,
  isReactionTarget,
  isThreadKey,
  parseEngagementList,
  parsePhilosopherResourceKey,
  parseReactionTargetKey,
  philosopherReplyThreadKey,
  reactionTargetKey,
  type EngagementPart,
  type ReactionCounts,
  type ReactionKind,
  type ReactionTarget,
} from "../../../src/lib/engagement-keys";
import { COMMENT_COLUMNS, THREAD_ROW_LIMIT } from "../routes/comments";
import { Q_E1, Q_E2, Q_E3, Q_E4, Q_E5, Q_E6, Q_E7, Q_F5 } from "./queries";
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
  type Query,
  type Row,
} from "./rows";

/**
 * D1 adapters of the comments group (design 4.2, 6): read.engagement (E1, E3, E5, F5),
 * me.engagement (E2, E4, E6) and read.engagement-counts (E7), answering the bodies of
 * workers/api/routes/comments.ts.
 */

const COMMENT_ROW_COLUMNS = [...columnsOf(COMMENT_COLUMNS), "like_count"];

/** The philosopher post columns the D1 copy keeps (PHILOSOPHER_COLUMNS without the dead counts). */
export const PHILOSOPHER_ROW_COLUMNS = [
  "id", "week_start", "slot", "resource_type", "resource_id", "name_ko", "name_en", "image_url", "body", "game_version",
] as const;

type Wanted = Partial<Record<EngagementPart, string[]>>;

function wantedParts(url: URL, parts: readonly EngagementPart[]): Wanted {
  const wanted: Wanted = {};
  for (const part of parts) {
    const raw = url.searchParams.get(part);
    if (raw === null) continue;
    const list = parseEngagementList(part, raw);
    if (!list) throw new AdapterInputError(part);
    wanted[part] = list;
  }
  return wanted;
}

function zero(): ReactionCounts {
  return { buff: 0, nerf: 0, rework: 0 };
}

export function commentRow(row: Row): Row {
  return pick({
    ...row,
    content_blocks: json(row.content_blocks),
    created_at: ts(row.created_at),
    palette_swapped: bool(row.palette_swapped),
  }, COMMENT_ROW_COLUMNS);
}

export function philosopherRow(row: Row): Row {
  return pick(row, PHILOSOPHER_ROW_COLUMNS);
}

function groupThreads(keys: readonly string[], rows: readonly Row[]): Record<string, Row[]> {
  const threads: Record<string, Row[]> = Object.fromEntries(keys.map((key) => [key, [] as Row[]]));
  for (const row of rows) threads[String(row.story_id)]?.push(commentRow(row));
  return threads;
}

function threadsQuery(keys: readonly string[]): Query {
  return query(Q_E1, jsonList(keys));
}

/** read.engagement: the coalesced public read of comment threads, like counts, reaction totals and philosopher posts. */
export async function engagementAdapter(context: AdapterContext): Promise<Row> {
  const wanted = wantedParts(context.url, ENGAGEMENT_PARTS);
  const body: Row = { v: 1, env: context.dataEnv };
  const unavailable = new Set<EngagementPart>();
  const threadKeys = wanted.threads ?? [];
  const likeKeys = wanted.likes ?? [];
  const targets = (wanted.reactions ?? []).map((key) => parseReactionTargetKey(key) as ReactionTarget);
  const resources = wanted.philosophers ?? [];
  const resourceParts = resources.map((key) => parsePhilosopherResourceKey(key) as { resourceType: string; resourceId: string });

  const first: Query[] = [];
  const at: Record<string, number> = {};
  const add = (name: string, item: Query) => {
    at[name] = first.length;
    first.push(item);
  };
  const ids = [...new Set([...targets.map((target) => target.resourceId), ...resourceParts.map((part) => part.resourceId)])];
  if (ids.length) add("reactions", query(Q_E5, jsonList(ids)));
  resourceParts.forEach((part, index) => add(`philosophers:${index}`, query(Q_F5, part.resourceType, part.resourceId)));
  if (likeKeys.length) add("likes", query(Q_E3, jsonList(likeKeys)));
  if (!resources.length && threadKeys.length) add("threads", threadsQuery(threadKeys));
  const results = await readAll(context.db, first);

  let all: Record<string, ReactionCounts> | null = null;
  if ("reactions" in at) {
    all = {};
    for (const row of results[at.reactions]) {
      all[reactionTargetKey({ resourceType: String(row.resource_type), resourceId: String(row.resource_id), gameVersion: String(row.game_version) })] = {
        buff: Number(row.buff_count ?? 0),
        nerf: Number(row.nerf_count ?? 0),
        rework: Number(row.rework_count ?? 0),
      };
    }
  }
  if ("threads" in at) {
    const rows = results[at.threads];
    if (rows.length >= THREAD_ROW_LIMIT) unavailable.add("threads");
    else body.threads = groupThreads(threadKeys, rows);
  }
  if ("likes" in at) {
    const counts = new Map(results[at.likes].map((row) => [String(row.thread_key), Number(row.like_count)]));
    body.likes = Object.fromEntries(likeKeys.map((key) => [key, counts.get(key) ?? 0]));
  }
  if (targets.length && all) {
    const totals = all;
    body.reactions = Object.fromEntries(targets.map((target) => [reactionTargetKey(target), totals[reactionTargetKey(target)] ?? zero()]));
  }

  if (resources.length) {
    const philosophers: Record<string, Row[]> = {};
    resources.forEach((key, index) => {
      philosophers[key] = results[at[`philosophers:${index}`]].map(philosopherRow);
    });
    body.philosophers = philosophers;
    const replyKeys: string[] = [];
    const derived: Record<string, ReactionCounts> = {};
    for (const row of Object.values(philosophers).flat()) {
      if (typeof row.id === "string" && row.id) {
        const key = philosopherReplyThreadKey(row.id);
        if (isThreadKey(key) && !threadKeys.includes(key) && !replyKeys.includes(key)) replyKeys.push(key);
      }
      const resourceType = typeof row.resource_type === "string" && row.resource_type ? row.resource_type : row.slot;
      const target = { resourceType: String(resourceType ?? ""), resourceId: String(row.resource_id ?? ""), gameVersion: String(row.game_version ?? "") };
      const key = reactionTargetKey(target);
      if (all && isReactionTarget(target) && !(body.reactions && key in (body.reactions as Row))) derived[key] = all[key] ?? zero();
    }
    if (Object.keys(derived).length) body.reactions = { ...(body.reactions as Row | undefined), ...derived };
    const keys = [...threadKeys, ...replyKeys];
    if (keys.length) {
      const [rows] = await readAll(context.db, [threadsQuery(keys)]);
      if (rows.length < THREAD_ROW_LIMIT) body.threads = groupThreads(keys, rows);
      else if (threadKeys.length) unavailable.add("threads");
    }
  }

  if (unavailable.size) body.unavailable = [...unavailable];
  return body;
}

/** me.engagement: the caller's comment likes, likes and reactions among the listed keys. */
export async function engagementMeAdapter(context: AdapterContext): Promise<Row> {
  const userId = context.userId;
  if (!userId) throw new AdapterInputError("user");
  const wanted = wantedParts(context.url, ENGAGEMENT_ME_PARTS);
  const body: Row = { v: 1, env: context.dataEnv };
  const unavailable = new Set<EngagementPart>();
  const threadKeys = wanted.threads ?? [];
  const likeKeys = wanted.likes ?? [];
  const targets = (wanted.reactions ?? []).map((key) => parseReactionTargetKey(key) as ReactionTarget);

  const queries: Query[] = [];
  const at: Record<string, number> = {};
  if (threadKeys.length) {
    at.threads = queries.length;
    queries.push(query(Q_E2, jsonList(threadKeys), userId));
  }
  if (likeKeys.length) {
    at.likes = queries.length;
    queries.push(query(Q_E4, jsonList(likeKeys), userId));
  }
  if (targets.length) {
    at.reactions = queries.length;
    queries.push(query(Q_E6, jsonList([...new Set(targets.map((target) => target.resourceId))]), userId));
  }
  const results = await readAll(context.db, queries);

  if ("threads" in at) {
    const rows = results[at.threads];
    // Same cap as the PostgREST read: a full page is reported unavailable, never cut.
    if (rows.length >= THREAD_ROW_LIMIT) {
      unavailable.add("threads");
    } else {
      const liked: Record<string, string[]> = Object.fromEntries(threadKeys.map((key) => [key, [] as string[]]));
      for (const row of rows) liked[String(row.story_id)]?.push(String(row.id));
      body.commentLikes = liked;
    }
  }
  if ("likes" in at) {
    const mine = new Set(results[at.likes].map((row) => String(row.story_id)));
    body.likes = Object.fromEntries(likeKeys.map((key) => [key, mine.has(key)]));
  }
  if ("reactions" in at) {
    const kinds: Record<string, ReactionKind | null> = Object.fromEntries(targets.map((target) => [reactionTargetKey(target), null]));
    for (const row of results[at.reactions]) {
      const key = reactionTargetKey({ resourceType: String(row.resource_type), resourceId: String(row.resource_id), gameVersion: String(row.game_version) });
      if (key in kinds && isReactionKind(row.kind)) kinds[key] = row.kind;
    }
    body.reactions = kinds;
  }
  if (unavailable.size) body.unavailable = [...unavailable];
  return body;
}

/** read.engagement-counts: non-zero like and comment counts of every thread key. */
export async function engagementCountsAdapter(context: AdapterContext): Promise<Row> {
  const [rows] = await readAll(context.db, [query(Q_E7)]);
  const likes: Record<string, number> = {};
  const comments: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row.thread_key);
    if (Number(row.like_count)) likes[key] = Number(row.like_count);
    if (Number(row.comment_count)) comments[key] = Number(row.comment_count);
  }
  return { v: 1, env: context.dataEnv, likes, comments };
}

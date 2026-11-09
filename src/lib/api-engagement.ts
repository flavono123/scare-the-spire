import { ApiUnavailableError, apiFetch } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import {
  ENGAGEMENT_LIMITS,
  ENGAGEMENT_QUERY_MAX_CHARS,
  isEngagementEntry,
  type EngagementPart,
  type ReactionCounts,
  type ReactionKind,
} from "@/lib/engagement-keys";

/**
 * The comments group's reads on the api path (docs/supabase-exit/STEP1_DESIGN.md 9.1).
 * Hooks ask for one part of one key; asks that arrive within a few milliseconds
 * share one /api/read/engagement (or /api/me/engagement) request. An outage,
 * or an answer of another version, rejects every ask of the batch with
 * ApiUnavailableError (step 6 has no legacy query to redo it on).
 */

export type ApiComment = {
  id: string;
  story_id: string;
  user_id: string;
  nickname: string;
  content: string;
  content_blocks: unknown;
  created_at: string;
  avatar_id: string | null;
  avatar_kind: string | null;
  palette_id: string | null;
  palette_swapped: boolean | null;
  like_count: number;
};

export type EngagementValue = {
  threads: ApiComment[];
  likes: number;
  reactions: ReactionCounts;
  philosophers: Record<string, unknown>[];
};

export type EngagementMeValue = {
  threads: string[];
  likes: boolean;
  reactions: ReactionKind | null;
};

type MePart = keyof EngagementMeValue;

type ReadBody = {
  v?: unknown;
  threads?: Record<string, ApiComment[]>;
  likes?: Record<string, number>;
  reactions?: Record<string, ReactionCounts>;
  philosophers?: Record<string, Record<string, unknown>[]>;
  unavailable?: string[];
};

type MeBody = {
  v?: unknown;
  commentLikes?: Record<string, string[]>;
  likes?: Record<string, boolean>;
  reactions?: Record<string, ReactionKind | null>;
  unavailable?: string[];
};

type Ask = { part: EngagementPart; key: string; resolve(value: unknown): void; reject(error: unknown): void };

// A batch goes out once no new ask came for BATCH_QUIET_MS, and never later than
// BATCH_MAX_WAIT_MS after its first ask. Patch pages mount each comment root in its
// own task, so the asks of one page arrive spread over tens of milliseconds.
const BATCH_QUIET_MS = 8;
const BATCH_MAX_WAIT_MS = 40;
// Philosophers' reply threads and reaction totals arrive before their widgets mount.
const PRIMED_MS = 15_000;
const QUERY_BUDGET = ENGAGEMENT_QUERY_MAX_CHARS - 200;

/**
 * True when the key is one the Worker takes. Hooks treat any other key as an
 * empty thread (no likes, no reactions, no posts): no row in either env has
 * such a key (docs/supabase-exit/STEP6_PLAN.md P15, P16), and one bad key would
 * fail the whole batch.
 */
export function engagementApiFor(part: EngagementPart, key: string): boolean {
  return isEngagementEntry(part, key);
}

const primed = new Map<string, { value: unknown; until: number }>();

function primedKey(part: string, key: string) {
  return `${part}|${key}`;
}

function takePrimed(part: EngagementPart, key: string): unknown {
  const entry = primed.get(primedKey(part, key));
  if (!entry) return undefined;
  primed.delete(primedKey(part, key));
  return entry.until > Date.now() ? entry.value : undefined;
}

/**
 * Asks already sent or queued, so two widgets on one key share one answer.
 * `joined` is false while only a prefetch waits on it.
 */
const inflight = new Map<string, { promise: Promise<unknown>; joined: boolean }>();
const inflightMine = new Map<string, Promise<unknown>>();

/** A write changed this key: drop anything held for it, and stop sharing a read started before the write. */
export function forgetEngagement(part: EngagementPart, key: string): void {
  primed.delete(primedKey(part, key));
  inflight.delete(primedKey(part, key));
  inflightMine.delete(primedKey(part, key));
}

function prime(part: EngagementPart, values: Record<string, unknown> | undefined, asked: Set<string>) {
  if (!values) return;
  const until = Date.now() + PRIMED_MS;
  for (const [key, value] of Object.entries(values)) {
    if (!asked.has(primedKey(part, key))) primed.set(primedKey(part, key), { value, until });
  }
}

/** Splits asks into batches under the per-part caps and the query length. */
function batches(asks: readonly Ask[], parts: readonly EngagementPart[]): Ask[][] {
  const result: { asks: Ask[]; keys: Map<EngagementPart, Set<string>>; length: number }[] = [];
  for (const ask of asks) {
    let batch = result.find((candidate) => {
      const keys = candidate.keys.get(ask.part) ?? new Set<string>();
      if (keys.has(ask.key)) return true;
      return keys.size < ENGAGEMENT_LIMITS[ask.part] && candidate.length + ask.key.length + ask.part.length + 2 <= QUERY_BUDGET;
    });
    if (!batch) {
      batch = { asks: [], keys: new Map(parts.map((part) => [part, new Set<string>()])), length: 0 };
      result.push(batch);
    }
    const keys = batch.keys.get(ask.part) as Set<string>;
    if (!keys.has(ask.key)) {
      keys.add(ask.key);
      batch.length += ask.key.length + ask.part.length + 2;
    }
    batch.asks.push(ask);
  }
  return result.map((batch) => batch.asks);
}

/** Keys are charset-checked ([A-Za-z0-9._:-]), so the list needs no escaping. */
function queryFor(asks: readonly Ask[], parts: readonly EngagementPart[]): string {
  const lists = parts.flatMap((part) => {
    const keys = [...new Set(asks.filter((ask) => ask.part === part).map((ask) => ask.key))];
    return keys.length ? [`${part}=${keys.join(",")}`] : [];
  });
  return lists.join("&");
}

/** A body this client does not understand is an outage, like requireApiVersion's `bad_version`. */
function unknownBody(): ApiUnavailableError {
  return new ApiUnavailableError(200, "bad_version");
}

function settle(asks: readonly Ask[], pick: (ask: Ask) => unknown, unavailable: readonly string[] | undefined) {
  for (const ask of asks) {
    if (unavailable?.includes(ask.part)) {
      ask.reject(new ApiUnavailableError(503));
      continue;
    }
    const value = pick(ask);
    if (value === undefined) ask.reject(new ApiUnavailableError(200, "bad_response"));
    else ask.resolve(value);
  }
}

function createQueue(send: (asks: Ask[]) => Promise<void>) {
  let pending: Ask[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstAskAt = 0;
  const flush = () => {
    const asks = pending;
    pending = [];
    timer = null;
    void send(asks);
  };
  return function ask<T>(part: EngagementPart, key: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.push({ part, key, resolve: resolve as (value: unknown) => void, reject });
      const now = Date.now();
      if (timer === null) firstAskAt = now;
      else clearTimeout(timer);
      timer = setTimeout(flush, Math.max(0, Math.min(BATCH_QUIET_MS, firstAskAt + BATCH_MAX_WAIT_MS - now)));
    });
  };
}

const READ_PARTS: readonly EngagementPart[] = ["threads", "likes", "reactions", "philosophers"];
const ME_PARTS: readonly EngagementPart[] = ["threads", "likes", "reactions"];

const askRead = createQueue(async (asks) => {
  await Promise.all(batches(asks, READ_PARTS).map(async (batch) => {
    try {
      const body = await apiFetch<ReadBody>("comments", `/api/read/engagement?${queryFor(batch, READ_PARTS)}`);
      if (body?.v !== 1) throw unknownBody();
      // A batch with philosophers holds every thread and reaction it returned, asked ones too:
      // a read-only bar under a post of the current version asks for the header's target again.
      const asked = body.philosophers ? new Set<string>() : new Set(batch.map((ask) => primedKey(ask.part, ask.key)));
      prime("threads", body.threads, asked);
      prime("reactions", body.reactions, asked);
      settle(batch, (ask) => (body[ask.part as keyof ReadBody] as Record<string, unknown> | undefined)?.[ask.key], body.unavailable);
    } catch (error) {
      for (const ask of batch) ask.reject(error);
    }
  }));
});

const ME_FIELD: Record<MePart, keyof MeBody> = { threads: "commentLikes", likes: "likes", reactions: "reactions" };

const askMe = createQueue(async (asks) => {
  await Promise.all(batches(asks, ME_PARTS).map(async (batch) => {
    try {
      const body = await apiFetchAsUser<MeBody>("comments", `/api/me/engagement?${queryFor(batch, ME_PARTS)}`);
      if (body?.v !== 1) throw unknownBody();
      settle(batch, (ask) => (body[ME_FIELD[ask.part as MePart]] as Record<string, unknown> | undefined)?.[ask.key], body.unavailable);
    } catch (error) {
      for (const ask of batch) ask.reject(error);
    }
  }));
});

/** One part of one key from /api/read/engagement. */
export function loadEngagement<P extends EngagementPart>(part: P, key: string): Promise<EngagementValue[P]> {
  const held = takePrimed(part, key);
  if (held !== undefined) return Promise.resolve(held as EngagementValue[P]);
  const id = primedKey(part, key);
  const running = inflight.get(id);
  if (running) {
    running.joined = true;
    return running.promise as Promise<EngagementValue[P]>;
  }
  const entry = { promise: askRead<EngagementValue[P]>(part, key) as Promise<unknown>, joined: true };
  inflight.set(id, entry);
  entry.promise.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    if (inflight.get(id) === entry) inflight.delete(id);
  });
  return entry.promise as Promise<EngagementValue[P]>;
}

/**
 * Asks for many keys at once before their widgets mount (patch pages mount each
 * comment root in its own task, which would otherwise spread the asks over
 * several batches). A widget that mounts while the ask runs shares it; one that
 * mounts after it settles takes the held answer once (15 s).
 */
export function prefetchEngagement(part: EngagementPart, keys: readonly string[]): void {
  for (const key of new Set(keys)) {
    if (!engagementApiFor(part, key)) continue;
    const id = primedKey(part, key);
    if (inflight.has(id) || primed.has(id)) continue;
    const entry = { promise: askRead<unknown>(part, key), joined: false };
    inflight.set(id, entry);
    entry.promise.then(
      (value) => {
        if (!entry.joined && inflight.get(id) === entry) primed.set(id, { value, until: Date.now() + PRIMED_MS });
      },
      () => undefined,
    ).finally(() => {
      if (inflight.get(id) === entry) inflight.delete(id);
    });
  }
}

/** One part of one key from /api/me/engagement (needs a session). */
export function loadEngagementMine<P extends MePart>(part: P, key: string): Promise<EngagementMeValue[P]> {
  const id = primedKey(part, key);
  const running = inflightMine.get(id);
  if (running) return running as Promise<EngagementMeValue[P]>;
  const promise = askMe<EngagementMeValue[P]>(part, key);
  inflightMine.set(id, promise);
  promise.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    if (inflightMine.get(id) === promise) inflightMine.delete(id);
  });
  return promise;
}

import { isWriteGroup, WRITE_PAUSED_ERROR, WRITE_PAUSED_RETRY_AFTER_SECONDS } from "../../../src/lib/write-source-flags";
import { apiError, jsonResponse } from "../http";
import type { ApiRoute, UserRoute, UserRouteContext } from "../router";
import { supabaseApiConfig } from "../supabase-rest";
import { resolveUid, writeClock, type D1WriteHandler } from "./context";
import { readWriteGate, type WriteGate } from "./gate";
import { commentLike, createComment, deleteComment, reaction, threadLike } from "./handlers/engagement";
import { submitRun } from "./handlers/puzzlebox";
import { batchShareOnD1, deleteRun, shareRun, syncNicknames, updateCover } from "./handlers/runs";
import { createStory, deleteStory, markRepliesSeen, submitInquiry } from "./handlers/stories-contact";
import {
  createDraft,
  createPost,
  deleteDraft,
  deletePost,
  thisOrThatLike,
  tournamentPlay,
  unvote,
  updateDraft,
  updatePost,
  upsertBody,
  vote,
} from "./handlers/toybox";
import { mirrorOutbox, type MirrorEnv } from "./mirror";

/**
 * Step 5 hook point of the /api router (docs/SUPABASE_EXIT_PLAN.md 7.3 step 5). For every write
 * route it reads the write gate: `write.paused` answers 503 write_paused with Retry-After;
 * `source.<group> = d1` runs the route's D1 handler instead of its Supabase handler. With no flag
 * set (today) it returns null and the route's own handler runs unchanged.
 */

/** Route id -> D1 handler. Every write route of API_ROUTES has one (checked by the spec). */
export const D1_WRITE_HANDLERS: Readonly<Record<string, D1WriteHandler>> = {
  "write.comments.create": createComment,
  "write.comments.delete": deleteComment,
  "write.comment-likes.put": (write) => commentLike(write, true),
  "write.comment-likes.delete": (write) => commentLike(write, false),
  "write.likes.put": (write) => threadLike(write, true),
  "write.likes.delete": (write) => threadLike(write, false),
  "write.reactions": reaction,
  "write.stories.create": createStory,
  "write.stories.delete": deleteStory,
  "write.contact-inquiries": submitInquiry,
  "write.profile.inquiries-seen": markRepliesSeen,
  "write.history-runs.create": batchShareOnD1,
  "write.history-runs.batch": batchShareOnD1,
  "write.history-runs.share": shareRun,
  "write.history-runs.cover": updateCover,
  "write.history-runs.nicknames": syncNicknames,
  "write.history-runs.delete": deleteRun,
  "write.toybox-post.create": createPost,
  "write.toybox-post.update": updatePost,
  "write.toybox-post.delete": deletePost,
  "write.favorite-tournament.play": tournamentPlay,
  "write.pagestorm.drafts.create": createDraft,
  "write.pagestorm.drafts.update": updateDraft,
  "write.pagestorm.drafts.delete": deleteDraft,
  "write.defragment-body": upsertBody,
  "write.this-or-that.like.put": (write) => thisOrThatLike(write, true),
  "write.this-or-that.like.delete": (write) => thisOrThatLike(write, false),
  "write.this-or-that.vote.put": vote,
  "write.this-or-that.vote.delete": unvote,
  "write.puzzlebox.runs": submitRun,
};

/** The share route exists for the D1 source only; on Supabase the client keeps the batch upload. */
export const SHARE_UNAVAILABLE = "single_run_unavailable";

/** Routes only the D1 source serves (design 4.4: one run per request). */
export const D1_WRITE_ROUTES: readonly ApiRoute[] = [
  {
    id: "write.history-runs.share",
    method: "POST",
    path: "/api/write/history-runs/share",
    group: "history-runs",
    access: "write",
    query: {},
    rawBody: { maxBytes: 2 * 1024 * 1024 },
    handle: async (context) => {
      void context.bodyStream?.cancel().catch(() => undefined);
      return jsonResponse({ error: SHARE_UNAVAILABLE }, { status: 409 });
    },
  },
];

export function writePausedResponse(): Response {
  return jsonResponse(
    { error: WRITE_PAUSED_ERROR },
    { status: 503, headers: { "Retry-After": String(WRITE_PAUSED_RETRY_AFTER_SECONDS) } },
  );
}

/** When the gate cannot be read: the Worker's env default (API_WRITE_SOURCE_DEFAULT), never paused. */
function fallbackGate(context: UserRouteContext): WriteGate {
  const source = (context.env as { API_WRITE_SOURCE_DEFAULT?: string }).API_WRITE_SOURCE_DEFAULT === "d1" ? "d1" : "supabase";
  return {
    paused: false,
    sources: {
      comments: source,
      stories: source,
      "toybox-feed": source,
      "history-runs": source,
      puzzlebox: source,
      profile: source,
      contact: source,
    },
  };
}

export async function d1WriteHook(route: UserRoute, context: UserRouteContext): Promise<Response | null> {
  if (route.access !== "write" || !isWriteGroup(route.group)) return null;
  const gate = (await readWriteGate(context.db ?? undefined, context.now)) ?? fallbackGate(context);
  if (gate.paused) {
    void context.bodyStream?.cancel().catch(() => undefined);
    return writePausedResponse();
  }
  if (gate.sources[route.group] !== "d1") return null;
  const handler = D1_WRITE_HANDLERS[route.id];
  const db = context.db;
  const config = supabaseApiConfig(context.env);
  if (!handler || !db || !config) return apiError("unavailable");
  const uid = await resolveUid(context);
  if (!uid) return apiError("token_invalid");
  let response: Response;
  try {
    response = await handler({ context, db, uid, dataEnv: config.dataEnv, ...writeClock(context.now) });
  } catch {
    return apiError("unavailable");
  }
  if (response.status < 300) {
    // Mirror right away; the 1-minute cron picks up whatever this leaves (design 5.5).
    context.ctx.waitUntil(mirrorOutbox(context.env as MirrorEnv, { maxRows: 5 }).catch(() => undefined));
  }
  return response;
}

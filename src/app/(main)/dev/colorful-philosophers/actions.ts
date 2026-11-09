"use server";

import {
  colorfulPhilosopherPostFromRow,
  isMissingColorfulPhilosopherPosts,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
// Server-only operator tools (plan 5.7): the env's D1 through wrangler, Supabase through fetch.
import { adminDeps } from "../../../../../scripts/admin/admin-deps";
import { listPhilosopherPosts } from "../../../../../scripts/admin/admin-reads";
import { AdminWriteError, saveColorfulPhilosopherPostRow, WritesPausedError } from "../../../../../scripts/admin/admin-writes";
import { philosopherPostRow } from "../../../../../scripts/admin/philosopher-post-row";
import { d1EnvOf } from "../../../../../scripts/lib/d1-remote";

type SaveResult =
  | { ok: true; post: ColorfulPhilosopherPost }
  | { ok: false; error: string };

type WeekResult =
  | { ok: true; posts: ColorfulPhilosopherPost[] }
  | { ok: false; error: string };

/**
 * The week list of either env, for the editor's timeline and the slot preview: from the store the
 * save writes to (the env's D1 once some group is on d1, Supabase before), so a save shows at once.
 */
export async function listColorfulPhilosopherWeek(env: "development" | "production"): Promise<WeekResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "개발 서버에서만 글을 볼 수 있습니다." };
  }
  const d1Env = d1EnvOf(env);
  if (!d1Env) return { ok: false, error: "알 수 없는 Supabase 환경입니다." };
  try {
    const rows = await listPhilosopherPosts(adminDeps(), d1Env);
    return {
      ok: true,
      posts: rows.flatMap((row) => {
        const post = colorfulPhilosopherPostFromRow(row);
        return post ? [post] : [];
      }),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "글을 읽지 못했습니다." };
  }
}

export async function saveColorfulPhilosopherPost(input: {
  env: "development" | "production";
  weekStart: string;
  slot: string;
  resourceType: string;
  resourceId: string;
  body: string;
}): Promise<SaveResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "개발 서버에서만 글을 만들 수 있습니다." };
  }
  const prepared = await philosopherPostRow(input);
  if (!prepared.ok) return prepared;

  try {
    // Supabase while every write group of the env is on Supabase, D1 and its outbox row after.
    const saved = await saveColorfulPhilosopherPostRow(adminDeps(), input.env, prepared.row);
    const post = saved.saved ? colorfulPhilosopherPostFromRow(saved.saved) : null;
    if (!post) return { ok: false, error: "글을 읽지 못했습니다." };
    return { ok: true, post };
  } catch (error) {
    if (error instanceof AdminWriteError) {
      if (error.message === "SUPABASE_SECRET_KEY is not configured") return { ok: false, error: "SUPABASE_SECRET_KEY가 없습니다." };
      if (isMissingColorfulPhilosopherPosts(error)) {
        return { ok: false, error: "colorful_philosopher_posts 마이그레이션이 필요합니다." };
      }
      return { ok: false, error: error.message };
    }
    if (error instanceof WritesPausedError) return { ok: false, error: error.message };
    return { ok: false, error: error instanceof Error ? error.message : "저장에 실패했습니다." };
  }
}

import { buildApiOrigin, buildDataEnv, fetchBuildApi, reportBuildDataFailure } from "@/lib/build-api-read";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { BUILTIN_SAMPLE_TRANSFIGURES } from "@/lib/transfigure-builtins";
import { RECENT_TRANSFIGURE_COUNT, RECENT_TRANSFIGURE_FEED_PATH, recentTransfiguresFromFeed } from "@/lib/transfigure-reel";

const SOURCE = "transfigure feed (/api/read/toybox-feed)";

const cache = new Map<string, Promise<TransfigurePost[]>>();

/**
 * Build-time snapshot of the newest transfigures for the static patch reel,
 * read from the site's /api. The feed answers one page of 20, so `limit`
 * stops there.
 */
export function getRecentTransfigurePosts(limit = RECENT_TRANSFIGURE_COUNT): Promise<TransfigurePost[]> {
  const env = buildDataEnv();
  const cacheKey = `${env}:${buildApiOrigin(env)}:${limit}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const promise = fetchRecentTransfigurePosts(env, limit);
  cache.set(cacheKey, promise);
  promise.catch(() => cache.delete(cacheKey));
  return promise;
}

async function readPosts(env: string, limit: number): Promise<TransfigurePost[]> {
  const rows = await fetchBuildApi(env, RECENT_TRANSFIGURE_FEED_PATH);
  if (!Array.isArray(rows)) throw new Error("the transfigure feed answered without rows");
  return recentTransfiguresFromFeed(rows, limit);
}

/** Rows of `env`; a build that is not production borrows production's when it has none. */
async function fetchNormalizedPosts(env: string, limit: number): Promise<TransfigurePost[]> {
  const posts = await readPosts(env, limit);
  if (posts.length > 0) return posts;
  if (env === "production") throw new Error("the transfigure feed has no rows");

  const productionPosts = await readPosts("production", limit);
  if (productionPosts.length > 0) return productionPosts;
  throw new Error("the transfigure feed has no rows");
}

async function fetchRecentTransfigurePosts(env: string, limit: number): Promise<TransfigurePost[]> {
  try {
    return await fetchNormalizedPosts(env, limit);
  } catch (cause) {
    reportBuildDataFailure(SOURCE, cause);
    return [...BUILTIN_SAMPLE_TRANSFIGURES];
  }
}

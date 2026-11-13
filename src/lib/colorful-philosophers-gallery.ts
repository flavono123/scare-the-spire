import { buildApiOrigin, buildDataEnv, fetchBuildApi, reportBuildDataFailure } from "@/lib/build-api-read";
import {
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersReelPosts,
  colorfulPhilosophersWeekStart,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { isReactionTarget, reactionTargetKey, type ReactionTarget } from "@/lib/engagement-keys";

const SOURCE = "colorful philosophers reel (/api/read/colorful-philosophers/reel)";
const REEL_PATH = "/api/read/colorful-philosophers/reel";

const cache = new Map<string, Promise<ColorfulPhilosopherPost[]>>();

/**
 * Build-time snapshot of the reel week for the static patch page, read from
 * the site's /api. Not a request-time query; the browser refreshes the week
 * and counts after load. One read per build, because every language of the
 * page asks for it.
 */
export function getColorfulPhilosopherGalleryPosts(): Promise<ColorfulPhilosopherPost[]> {
  const env = buildDataEnv();
  const currentWeek = colorfulPhilosophersWeekStart();
  const cacheKey = `${env}:${buildApiOrigin(env)}:${currentWeek}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const promise = fetchGalleryPosts(env, currentWeek);
  cache.set(cacheKey, promise);
  promise.catch(() => cache.delete(cacheKey));
  return promise;
}

async function fetchGalleryPosts(env: string, currentWeek: string): Promise<ColorfulPhilosopherPost[]> {
  try {
    // The Worker reads `week_start <= this KST week`, newest first, 12 rows.
    const body = (await fetchBuildApi(env, REEL_PATH)) as { v?: unknown; posts?: unknown } | null;
    if (body?.v !== 1 || !Array.isArray(body.posts)) throw new Error("the reel answered without posts");
    const posts = colorfulPhilosophersReelPosts(
      body.posts.flatMap((row) => {
        const post = colorfulPhilosopherPostFromRow(row ?? {});
        return post ? [post] : [];
      }),
      currentWeek,
    );
    return await withResourceReactionCounts(env, posts);
  } catch (cause) {
    reportBuildDataFailure(SOURCE, cause);
    return [];
  }
}

/** Votes live per resource (resource_reaction_counts); a failed read keeps the posts' own counts. */
async function withResourceReactionCounts(
  env: string,
  posts: ColorfulPhilosopherPost[],
): Promise<ColorfulPhilosopherPost[]> {
  if (posts.length === 0) return posts;
  const targets: ReactionTarget[] = posts.map((post) => ({
    resourceType: post.resourceType,
    resourceId: post.resourceId,
    gameVersion: post.gameVersion,
  }));
  // The Worker refuses the whole query for one key outside its rule, so that is a failed read too.
  if (!targets.every(isReactionTarget)) return posts;
  const keys = Array.from(new Set(targets.map(reactionTargetKey)));
  try {
    const body = (await fetchBuildApi(
      env,
      `/api/read/engagement?reactions=${encodeURIComponent(keys.join(","))}`,
    )) as { v?: unknown; reactions?: unknown } | null;
    if (body?.v !== 1 || !body.reactions || typeof body.reactions !== "object") {
      throw new Error("the engagement read answered without reactions");
    }
    const reactions = body.reactions as Record<string, { buff?: unknown; nerf?: unknown; rework?: unknown } | undefined>;
    return posts.map((post) => {
      const row = reactions[reactionTargetKey({
        resourceType: post.resourceType,
        resourceId: post.resourceId,
        gameVersion: post.gameVersion,
      })];
      return {
        ...post,
        ...(row
          ? { buffCount: Number(row.buff) || 0, nerfCount: Number(row.nerf) || 0, reworkCount: Number(row.rework) || 0 }
          : { buffCount: 0, nerfCount: 0, reworkCount: 0 }),
      };
    });
  } catch {
    return posts;
  }
}

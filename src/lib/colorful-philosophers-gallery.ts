import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersReelPosts,
  colorfulPhilosophersWeekStart,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { supabaseEnv } from "@/lib/supabase";

const COLUMNS = "id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count";

/**
 * Build-time snapshot of the reel week for the static patch page. Not a
 * request-time query; the browser refreshes the week and counts after load.
 */
export async function getColorfulPhilosopherGalleryPosts(): Promise<ColorfulPhilosopherPost[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const env = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? supabaseEnv ?? "production";
  if (!url || !key) return [];
  const client = createClient(url, key);
  const currentWeek = colorfulPhilosophersWeekStart();
  try {
    const { data, error } = await client
      .from(COLORFUL_PHILOSOPHERS_POSTS_TABLE)
      .select(COLUMNS)
      .eq("env", env)
      .lte("week_start", currentWeek)
      .order("week_start", { ascending: false })
      .limit(12);
    if (error || !data) return [];
    const posts = colorfulPhilosophersReelPosts(
      data.flatMap((row) => {
        const post = colorfulPhilosopherPostFromRow(row);
        return post ? [post] : [];
      }),
      currentWeek,
    );
    return withResourceReactionCounts(client, env, posts);
  } catch {
    return [];
  }
}

/** Post rows carry legacy per-post counts; votes now live per resource. */
async function withResourceReactionCounts(
  client: SupabaseClient,
  env: string,
  posts: ColorfulPhilosopherPost[],
): Promise<ColorfulPhilosopherPost[]> {
  if (posts.length === 0) return posts;
  const key = (type: string, id: string, version: string) => `${type}:${id}:${version}`;
  try {
    const ids = Array.from(new Set(posts.map((post) => post.resourceId)));
    const { data, error } = await client
      .from("resource_reaction_counts")
      .select("resource_type, resource_id, game_version, buff_count, nerf_count, rework_count")
      .eq("env", env)
      .in("resource_id", ids);
    if (error || !data) return posts;
    const counts = new Map(
      (data as Array<Record<string, unknown>>).map((row) => [
        key(String(row.resource_type), String(row.resource_id), String(row.game_version)),
        {
          buffCount: Number(row.buff_count) || 0,
          nerfCount: Number(row.nerf_count) || 0,
          reworkCount: Number(row.rework_count) || 0,
        },
      ]),
    );
    return posts.map((post) => ({
      ...post,
      ...(counts.get(key(post.resourceType, post.resourceId, post.gameVersion))
        ?? { buffCount: 0, nerfCount: 0, reworkCount: 0 }),
    }));
  } catch {
    return posts;
  }
}

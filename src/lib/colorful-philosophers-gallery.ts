import { createClient } from "@supabase/supabase-js";
import {
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersWeekStart,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { supabaseEnv } from "@/lib/supabase";

const COLUMNS = "id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count";

/** Build-time snapshot for the static patch page. Not a request-time query. */
export async function getColorfulPhilosopherGalleryPosts(): Promise<ColorfulPhilosopherPost[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const env = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? supabaseEnv ?? "production";
  if (!url || !key) return [];
  const client = createClient(url, key);
  const posts: ColorfulPhilosopherPost[] = [];
  const pageSize = 1000;
  try {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from(COLORFUL_PHILOSOPHERS_POSTS_TABLE)
        .select(COLUMNS)
        .eq("env", env)
        .lte("week_start", colorfulPhilosophersWeekStart())
        .order("week_start", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data) {
        const post = colorfulPhilosopherPostFromRow(row);
        if (post) posts.push(post);
      }
      if (data.length < pageSize) break;
    }
    return posts;
  } catch {
    return posts;
  }
}

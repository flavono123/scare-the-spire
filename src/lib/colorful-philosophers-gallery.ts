import { createClient } from "@supabase/supabase-js";
import {
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersWeekStart,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { supabaseEnv } from "@/lib/supabase";

const COLUMNS = "id, week_start, slot, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count";

/** Build-time snapshot for the static patch page. Not a request-time query. */
export async function getColorfulPhilosopherGalleryPosts(limit = 12): Promise<ColorfulPhilosopherPost[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const env = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? supabaseEnv ?? "production";
  if (!url || !key) return [];
  try {
    const { data, error } = await createClient(url, key)
      .from(COLORFUL_PHILOSOPHERS_POSTS_TABLE)
      .select(COLUMNS)
      .eq("env", env)
      .lte("week_start", colorfulPhilosophersWeekStart())
      .order("week_start", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.flatMap((row) => {
      const post = colorfulPhilosopherPostFromRow(row);
      return post ? [post] : [];
    });
  } catch {
    return [];
  }
}

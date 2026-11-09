import { normalizeTransfigurePost, type TransfigurePost } from "@/lib/transfigure-types";

/** The patch reel shows the newest transfigures: the first rows of the latest feed page (20). */
export const RECENT_TRANSFIGURE_COUNT = 15;

/** The latest transfigure feed page, as the browser asks for it (toybox-api.ts apiToyboxFeed). */
export const RECENT_TRANSFIGURE_FEED_PATH = "/api/read/toybox-feed?service=transfigure&sort=latest";

/**
 * Feed rows are `{ id, created_at, like_count, comment_count, recommend_score, post }`,
 * where `post` is the whole transfigure_posts row (get_toybox_feed's to_jsonb(p.*)),
 * the row the reel normalized when it read the table with `select *`.
 */
export function recentTransfiguresFromFeed(rows: readonly unknown[], limit = RECENT_TRANSFIGURE_COUNT): TransfigurePost[] {
  return rows.slice(0, limit).map((row) => {
    const nested = row && typeof row === "object" ? (row as { post?: unknown }).post : undefined;
    return normalizeTransfigurePost(nested && typeof nested === "object" ? nested : row);
  });
}

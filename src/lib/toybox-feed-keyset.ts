/**
 * Supabase-free feed paging helpers. `toybox-feed.ts` re-exports them; pure
 * modules (combo-types, and through it the main Worker OG code) import them
 * from here so they do not bundle supabase-js.
 */
export const TOYBOX_FEED_PAGE_SIZE = 20;

export function buildLatestFeedKeysetFilter(cursor: {
  createdAt: string;
  id: string;
}): string {
  const createdAt = cursor.createdAt.replaceAll('"', "");
  const id = cursor.id.replaceAll('"', "");
  return `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${id}")`;
}

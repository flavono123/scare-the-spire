/**
 * The toybox-feed group's services, sorts, cursors and ids (docs/supabase-exit/STEP1_DESIGN.md 9.8),
 * shared by the toybox hooks and the Worker. No imports: the Worker bundle uses it.
 */

/** Every toybox post table the api path reads or writes, by service. */
export const TOYBOX_POST_TABLES = {
  combo: "combo_posts",
  transfigure: "transfigure_posts",
  this_or_that: "this_or_that_posts",
  chemical_x: "chemical_posts",
  decisions_decisions: "decisions_decisions_posts",
  favorite_tournament: "favorite_tournament_posts",
  pagestorm: "pagestorm_posts",
  defragment: "defragment_posts",
} as const;

export type ToyboxPostService = keyof typeof TOYBOX_POST_TABLES;

/** Services whose posts have an update policy (SURFACE_MAP 4.1). */
export const TOYBOX_UPDATABLE_SERVICES: readonly ToyboxPostService[] = ["combo", "transfigure", "decisions_decisions", "pagestorm", "defragment"];

/** Services get_toybox_feed serves (toybox-feed.ts TOYBOX_FEED_SERVICES). */
export const TOYBOX_RPC_FEED_SERVICES = ["combo", "transfigure", "this_or_that", "chemical_x", "decisions_decisions", "favorite_tournament", "pagestorm"] as const;
export const TOYBOX_FEED_SORT_VALUES = ["latest", "recommended", "comments", "vote_rate_high", "vote_rate_low", "play_count"] as const;
export const DEFRAGMENT_RUN_SORTS = ["latest", "recommended", "comments"] as const;
export const TOYBOX_PAGE_SIZE = 20;

export const THIS_OR_THAT_VOTE_SURFACES = ["index", "detail"] as const;
export const THIS_OR_THAT_CHOICES = ["left", "right"] as const;
/** get_this_or_that_vote_summaries refuses more than 50 ids (schema:1873). */
export const THIS_OR_THAT_SUMMARY_IDS = 50;
export const TOYBOX_IDS_MAX = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Post ids are uuids; history-course rows in the defragment feed use run ids. */
const ROW_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SCORE = /^-?\d{1,12}$/;
const ISO = /^\d{4}-\d{2}-\d{2}[T ][0-9:.]{8,15}(?:Z|[+-]\d{2}(?::?\d{2})?)?$/;
const SOURCE_SERVICE = /^[a-z_]{1,32}$/;

export function isToyboxPostService(value: string): value is ToyboxPostService {
  return Object.hasOwn(TOYBOX_POST_TABLES, value);
}

export function isToyboxUpdatable(value: string): boolean {
  return (TOYBOX_UPDATABLE_SERVICES as readonly string[]).includes(value);
}

export function isToyboxFeedService(value: string): boolean {
  return (TOYBOX_RPC_FEED_SERVICES as readonly string[]).includes(value);
}

export function isToyboxFeedSort(value: string): boolean {
  return (TOYBOX_FEED_SORT_VALUES as readonly string[]).includes(value);
}

export function isDefragmentRunSort(value: string): boolean {
  return (DEFRAGMENT_RUN_SORTS as readonly string[]).includes(value);
}

export function isPostUuid(value: string): boolean {
  return UUID.test(value);
}

export function isRowId(value: string): boolean {
  return ROW_ID.test(value);
}

export function isCursorScore(value: string): boolean {
  return SCORE.test(value);
}

export function isCursorCreatedAt(value: string): boolean {
  return ISO.test(value);
}

export function isSourceService(value: string): boolean {
  return SOURCE_SERVICE.test(value);
}

/** `a,b,c` uuids, unique, at most `max`. */
export function parsePostIds(value: string, max = TOYBOX_IDS_MAX): string[] | null {
  if (!value) return null;
  const ids = value.split(",");
  if (ids.length > max || new Set(ids).size !== ids.length) return null;
  return ids.every(isPostUuid) ? ids : null;
}

/** Cursor query fields shared by the feed endpoints; all three or none. */
export function cursorQuery(cursor: { score: number; createdAt: string; id: string } | null): Record<string, string> {
  if (!cursor) return {};
  return { score: String(Math.trunc(cursor.score)), created_at: cursor.createdAt, cursor_id: cursor.id };
}

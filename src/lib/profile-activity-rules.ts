/**
 * Profile activity categories, sorts and page size, shared by the profile hook
 * and the Worker's /api/me/profile/activity (docs/supabase-exit/STEP1_DESIGN.md 9.4).
 * No imports: the Worker bundle uses it.
 */

export const PROFILE_ACTIVITY_CATEGORIES = [
  "stories",
  "chemical_x",
  "this_or_that",
  "combo",
  "comments",
  "history_course",
] as const;

export type ProfileActivityCategory = (typeof PROFILE_ACTIVITY_CATEGORIES)[number];
export type ProfileActivityFilter = "all" | ProfileActivityCategory;
export type ProfileActivitySort = "latest" | "likes";

export const PROFILE_ACTIVITY_SORTS: readonly ProfileActivitySort[] = ["latest", "likes"];
export const PROFILE_ACTIVITY_PAGE_SIZE = 20;
/** Far past any real history; keeps offsets small integers. */
export const PROFILE_ACTIVITY_MAX_OFFSET = 10_000;

export function isProfileActivityFilter(value: string): value is ProfileActivityFilter {
  return value === "all" || (PROFILE_ACTIVITY_CATEGORIES as readonly string[]).includes(value);
}

export function isProfileActivitySort(value: string): value is ProfileActivitySort {
  return (PROFILE_ACTIVITY_SORTS as readonly string[]).includes(value);
}

export function isProfileActivityOffset(value: string): boolean {
  if (!/^\d{1,5}$/.test(value)) return false;
  return Number(value) <= PROFILE_ACTIVITY_MAX_OFFSET;
}

/** The inquiry history columns; `reply_seen_at` arrived later, so readers fall back without it. */
export const CONTACT_INQUIRY_HISTORY_COLUMNS = "id,category,message,env,status,admin_response,reply_seen_at,created_at";
export const CONTACT_INQUIRY_HISTORY_COLUMNS_LEGACY = "id,category,message,env,status,admin_response,created_at";
export const CONTACT_INQUIRY_HISTORY_LIMIT = 50;

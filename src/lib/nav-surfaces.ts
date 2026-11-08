/**
 * The nav "new post" surfaces that read a database table, shared by the
 * browser (nav-seen.ts) and the Worker's /api/read/nav. Keep it free of
 * imports: the Worker bundle must not pull in supabase-js or data JSON.
 */

export const NAV_TABLE_SURFACES = [
  { id: "combo", table: "combo_posts" },
  { id: "transfigure", table: "transfigure_posts" },
  { id: "this-or-that", table: "this_or_that_posts" },
  { id: "favorite-tournament", table: "favorite_tournament_posts" },
  { id: "chemical-x", table: "chemical_posts" },
  { id: "decisions-decisions", table: "decisions_decisions_posts" },
  { id: "pagestorm", table: "pagestorm_posts" },
  { id: "history-course", table: "runs" },
] as const;

export type NavTableSurfaceId = (typeof NAV_TABLE_SURFACES)[number]["id"];
export type NavTable = (typeof NAV_TABLE_SURFACES)[number]["table"];

/** Weekly posts reserved ahead and published at a week's Monday 00:00 KST. */
export const NAV_WEEKLY_SURFACE = { id: "colorful-philosophers", table: "colorful_philosopher_posts" } as const;

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Monday (KST) of the week containing `now`, as YYYY-MM-DD. */
export function kstWeekStart(now = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const mondayOffset = (kst.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - mondayOffset));
  return monday.toISOString().slice(0, 10);
}

/** Monday 00:00 KST of `weekStart`, as an ISO instant. */
export function weeklyPublishedAt(weekStart: string): string {
  return new Date(`${weekStart.slice(0, 10)}T00:00:00+09:00`).toISOString();
}

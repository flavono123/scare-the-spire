import { courierCommentText } from "../../../src/lib/courier-comment-text";
import { canonicalTs } from "../../../src/lib/d1-time";
import { kstWeekStart, NAV_TABLE_SURFACES, type NavTableSurfaceId } from "../../../src/lib/nav-surfaces";
import type { NavCourierItem, NavSnapshotBody } from "../routes/nav";
import { Q_E8, Q_E9, Q_F4 } from "./queries";
import { query, readAll, ts, type AdapterContext } from "./rows";

/**
 * D1 adapter of read.nav (design 6: E8, E9 x 8, F4): the snapshot body fetchNavFromSupabase builds,
 * with the same conversions (ISO times through Date, courier text and truncation).
 */

const COURIER_WINDOW_MS = 14 * 24 * 60 * 60_000;
const COURIER_TEXT_MAX = 160;

/** Nav surface -> posts.service. */
export const NAV_SURFACE_SERVICES: Readonly<Record<NavTableSurfaceId, string>> = {
  combo: "combo",
  transfigure: "transfigure",
  "this-or-that": "this_or_that",
  "favorite-tournament": "favorite_tournament",
  "chemical-x": "chemical_x",
  "decisions-decisions": "decisions_decisions",
  pagestorm: "pagestorm",
  "history-course": "history_course",
};

// The same conversions as routes/nav.ts (isoOrNull, truncate), applied to the PostgREST strings.
function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function truncate(text: string): string {
  const chars = [...text];
  return chars.length > COURIER_TEXT_MAX ? `${chars.slice(0, COURIER_TEXT_MAX - 1).join("")}…` : text;
}

/** The nav snapshot as of `asOf` (the courier window and the KST week are taken at that time). */
export async function navAdapter(context: AdapterContext, asOf = context.now): Promise<NavSnapshotBody> {
  const since = canonicalTs(new Date(asOf - COURIER_WINDOW_MS).toISOString()) as string;
  const results = await readAll(context.db, [
    query(Q_E8, since),
    query(Q_F4, kstWeekStart(new Date(asOf))),
    ...NAV_TABLE_SURFACES.map((surface) => query(Q_E9, NAV_SURFACE_SERVICES[surface.id])),
  ]);
  const [courierRows, weeklyRows, ...latestRows] = results;
  const courier: NavCourierItem[] = courierRows.flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const storyId = typeof row.story_id === "string" ? row.story_id : "";
    const text = truncate(courierCommentText(typeof row.content === "string" ? row.content : ""));
    const createdAt = isoOrNull(ts(row.created_at));
    return id && storyId && text && createdAt ? [{ id, storyId, text, createdAt }] : [];
  });
  const weekValue = weeklyRows[0]?.week_start;
  const weekly = typeof weekValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(weekValue) ? weekValue.slice(0, 10) : null;
  const latest = Object.fromEntries(NAV_TABLE_SURFACES.map((surface, index) => [
    surface.id,
    isoOrNull(ts(latestRows[index][0]?.created_at)),
  ])) as Record<NavTableSurfaceId, string | null>;
  return {
    v: 1,
    env: context.dataEnv,
    fetchedAt: new Date(asOf).toISOString(),
    latest,
    weekly: { "colorful-philosophers": weekly },
    courier,
  };
}

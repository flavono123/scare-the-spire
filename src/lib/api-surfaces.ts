/**
 * Screen groups that move from browser-direct Supabase calls ("legacy") to the
 * same-origin Worker API ("api") during step 1 of the Supabase exit
 * (docs/supabase-exit/STEP1_DESIGN.md). Shared by the Worker, the browser and
 * scripts/runtime-flags.ts, so keep it free of imports.
 */

export const API_SURFACE_GROUPS = [
  "nav",
  "comments",
  "toybox-feed",
  "colorful-philosophers",
  "stories",
  "history-runs",
  "puzzlebox",
  "profile",
  "contact",
] as const;

export type ApiSurfaceGroup = (typeof API_SURFACE_GROUPS)[number];

export type SurfacePath = "legacy" | "api";

export const SURFACE_PATHS: readonly SurfacePath[] = ["legacy", "api"];

export function isApiSurfaceGroup(value: unknown): value is ApiSurfaceGroup {
  return typeof value === "string" && (API_SURFACE_GROUPS as readonly string[]).includes(value);
}

/** D1 key of a group's path flag. */
export function pathFlagKey(group: ApiSurfaceGroup): string {
  return `path.${group}`;
}

/** Cookie the Worker sets on page responses: `v1` plus the api groups, dot-joined. */
export const FLAG_COOKIE_NAME = "slseoun_rf";
const FLAG_COOKIE_VERSION = "v1";

/** QA cookies the Worker honors (STEP1_DESIGN 3.4). */
export const QA_COOKIE_NAME = "slseoun_qa";
export const QA_NO_SUPABASE = "no-supabase";
export const QA_PATH_COOKIE_NAME = "slseoun_qa_path";

/** Cookie value for the api groups, or null when every group is legacy. */
export function flagCookieValue(groups: Iterable<ApiSurfaceGroup>): string | null {
  const sorted = [...new Set(groups)].filter(isApiSurfaceGroup).sort();
  return sorted.length > 0 ? [FLAG_COOKIE_VERSION, ...sorted].join(".") : null;
}

/** Api groups in a cookie value; another version or garbage means none. */
export function parseFlagCookieValue(value: string | null | undefined): Set<ApiSurfaceGroup> | null {
  if (!value) return null;
  const [version, ...groups] = value.split(".");
  if (version !== FLAG_COOKIE_VERSION) return null;
  if (groups.length === 0 || !groups.every(isApiSurfaceGroup)) return null;
  return new Set(groups as ApiSurfaceGroup[]);
}

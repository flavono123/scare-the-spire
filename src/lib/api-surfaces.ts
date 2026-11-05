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

/** `<script type="application/json">` the Worker puts at the top of <head>. */
export const RUNTIME_FLAGS_ELEMENT_ID = "slseoun-runtime-flags";

/** What the Worker injects: only groups on the api path are listed. */
export type InjectedRuntimeFlags = {
  v: 1;
  path: Partial<Record<ApiSurfaceGroup, "api">>;
};

export function isApiSurfaceGroup(value: unknown): value is ApiSurfaceGroup {
  return typeof value === "string" && (API_SURFACE_GROUPS as readonly string[]).includes(value);
}

/** D1 key of a group's path flag. */
export function pathFlagKey(group: ApiSurfaceGroup): string {
  return `path.${group}`;
}

/** Groups on the api path in an injected payload; anything malformed means none. */
export function parseInjectedRuntimeFlags(text: string | null | undefined): Set<ApiSurfaceGroup> {
  const groups = new Set<ApiSurfaceGroup>();
  if (!text) return groups;
  try {
    const parsed = JSON.parse(text) as Partial<InjectedRuntimeFlags>;
    if (parsed?.v !== 1 || !parsed.path || typeof parsed.path !== "object") return groups;
    for (const [group, value] of Object.entries(parsed.path)) {
      if (isApiSurfaceGroup(group) && value === "api") groups.add(group);
    }
  } catch {
    // A broken payload keeps every screen on the legacy path.
  }
  return groups;
}

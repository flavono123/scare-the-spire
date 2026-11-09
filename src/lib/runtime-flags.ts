import type { ApiSurfaceGroup, SurfacePath } from "@/lib/api-surfaces";

/**
 * Page-wide runtime state shared by every bundle on the page (patch pages load several).
 *
 * Step 6 (docs/supabase-exit/STEP6_PLAN.md 1.1): the browser has no legacy path
 * any more, so every group is on the api path whatever the `slseoun_rf` cookie
 * says (the Worker still sends it for an older client after a rollback). A legacy
 * signal from the Worker is an outage (src/lib/api-client.ts), never a demotion.
 */

/**
 * `demoted` stays only for the patch static client, which still keeps its own
 * demotions here until WP-P; nothing in this bundle reads it. `nav` is the shared
 * nav snapshot promise (src/lib/nav-snapshot.ts and the patch static client).
 */
export type SlseounRuntime = {
  demoted: Set<string>;
  nav?: { promise: Promise<unknown>; at: number };
};

declare global {
  interface Window {
    __slseounRuntime?: SlseounRuntime;
  }
}

export function slseounRuntime(): SlseounRuntime {
  if (typeof window === "undefined") return { demoted: new Set() };
  window.__slseounRuntime ??= { demoted: new Set() };
  return window.__slseounRuntime;
}

/**
 * @deprecated Always "api" (step 6 has no legacy path). Kept while other step 6
 * packages still branch on it; WP-Z removes it with those branches.
 */
export function surfacePath(group: ApiSurfaceGroup): SurfacePath {
  void group;
  return "api";
}

/**
 * @deprecated Does nothing: a legacy signal no longer moves a group off the api
 * path. Kept while other step 6 packages still call it; WP-Z removes it.
 */
export function demoteSurface(group: ApiSurfaceGroup): void {
  void group;
}

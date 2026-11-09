/**
 * Page-wide runtime state shared by every bundle on the page (patch pages load several).
 *
 * Step 6 (docs/supabase-exit/STEP6_PLAN.md 1.1): the browser has no legacy path,
 * so there is no per-group path to read. The Worker still sends the `slseoun_rf`
 * cookie for an older client after a rollback; nothing here reads it. A legacy
 * signal from the Worker is an outage (src/lib/api-client.ts).
 */

/** `nav` is the shared nav snapshot promise (src/lib/nav-snapshot.ts and the patch static client). */
export type SlseounRuntime = {
  nav?: { promise: Promise<unknown>; at: number };
};

declare global {
  interface Window {
    __slseounRuntime?: SlseounRuntime;
  }
}

export function slseounRuntime(): SlseounRuntime {
  if (typeof window === "undefined") return {};
  window.__slseounRuntime ??= {};
  return window.__slseounRuntime;
}

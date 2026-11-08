import {
  FLAG_COOKIE_NAME,
  parseFlagCookieValue,
  type ApiSurfaceGroup,
  type SurfacePath,
} from "@/lib/api-surfaces";

/**
 * Which data path a screen group uses: "api" when the Worker's `slseoun_rf`
 * cookie lists the group and this page has not demoted it, "legacy" otherwise
 * (no cookie in `pnpm dev`, on the patch Worker's own host, or while every flag
 * is legacy). See docs/supabase-exit/STEP1_DESIGN.md 7.
 *
 * Read it only in effects and event handlers, never during render: the build
 * prerenders without cookies, so a render-time read would make the first
 * client render differ from the HTML and break hydration.
 */

/** Page-wide state shared by every bundle on the page (patch pages load several). */
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

function cookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const index = part.indexOf("=");
    if (index >= 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

/** Read on every call, so a newer page in another tab can move this one too. */
export function surfacePath(group: ApiSurfaceGroup): SurfacePath {
  if (slseounRuntime().demoted.has(group)) return "legacy";
  return parseFlagCookieValue(cookieValue(FLAG_COOKIE_NAME))?.has(group) ? "api" : "legacy";
}

/** The Worker sent a legacy signal: use the legacy path for the rest of this page. */
export function demoteSurface(group: ApiSurfaceGroup): void {
  slseounRuntime().demoted.add(group);
}

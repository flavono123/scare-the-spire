import {
  parseInjectedRuntimeFlags,
  RUNTIME_FLAGS_ELEMENT_ID,
  type ApiSurfaceGroup,
  type SurfacePath,
} from "@/lib/api-surfaces";

/**
 * Which data path a screen group uses in this page: "api" when the Worker put
 * the group in the injected flags script, "legacy" otherwise (no script in
 * `pnpm dev`, on the patch Worker's own host, or when every flag is legacy).
 *
 * Read it only in effects and event handlers, never during render: the build
 * prerenders with no document (legacy), so a render-time read would make the
 * first client render differ from the HTML and break hydration.
 */

let injected: Set<ApiSurfaceGroup> | null = null;
const demoted = new Set<ApiSurfaceGroup>();

function injectedGroups(): Set<ApiSurfaceGroup> {
  if (injected) return injected;
  if (typeof document === "undefined") return new Set();
  injected = parseInjectedRuntimeFlags(document.getElementById(RUNTIME_FLAGS_ELEMENT_ID)?.textContent);
  return injected;
}

export function surfacePath(group: ApiSurfaceGroup): SurfacePath {
  if (demoted.has(group)) return "legacy";
  return injectedGroups().has(group) ? "api" : "legacy";
}

/** The Worker answered 409 surface_legacy: use the legacy path for the rest of this page. */
export function demoteSurface(group: ApiSurfaceGroup): void {
  demoted.add(group);
}

/** Spec hook: forget the cached script and demotions. */
export function resetRuntimeFlagsForTest(): void {
  injected = null;
  demoted.clear();
}

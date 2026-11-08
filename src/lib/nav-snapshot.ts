import { apiFetch, SurfaceLegacyError } from "@/lib/api-client";
import { NAV_TABLE_SURFACES, type NavTableSurfaceId } from "@/lib/nav-surfaces";
import { demoteSurface, slseounRuntime } from "@/lib/runtime-flags";
import { supabaseEnv } from "@/lib/supabase";

/**
 * The /api/read/nav snapshot (docs/supabase-exit/STEP1_DESIGN.md 8.2), shared by
 * the nav dots and the comment courier, and across the bundles of a patch page
 * through window.__slseounRuntime. Kept 30 s, the response's max-age.
 */

export type NavSnapshot = {
  v: 1;
  env: string;
  fetchedAt: string;
  latest: Partial<Record<NavTableSurfaceId, string | null>>;
  weekly: { "colorful-philosophers"?: string | null };
  courier: { id: string; storyId: string; text: string; createdAt: string }[];
};

export const NAV_SNAPSHOT_TTL_MS = 30_000;

/** Throws SurfaceLegacyError for an unknown shape or another data env, so callers use legacy. */
export function validateNavSnapshot(value: unknown, expectedEnv: string): NavSnapshot {
  const snapshot = value as Partial<NavSnapshot> | null;
  if (
    !snapshot
    || snapshot.v !== 1
    || typeof snapshot.latest !== "object"
    || snapshot.latest === null
    || typeof snapshot.weekly !== "object"
    || snapshot.weekly === null
    || !Array.isArray(snapshot.courier)
  ) {
    throw new SurfaceLegacyError(200, false);
  }
  // Seen times are stored per env; comparing another env's posts would light the wrong dots.
  if (snapshot.env !== expectedEnv) {
    console.warn(`nav snapshot env ${String(snapshot.env)} differs from ${expectedEnv}; using the legacy path`);
    throw new SurfaceLegacyError(200, false);
  }
  return snapshot as NavSnapshot;
}

export function loadNavSnapshot(now = Date.now()): Promise<NavSnapshot> {
  const runtime = slseounRuntime();
  if (runtime.nav && now - runtime.nav.at < NAV_SNAPSHOT_TTL_MS) return runtime.nav.promise as Promise<NavSnapshot>;
  const promise = apiFetch<unknown>("nav", "/api/read/nav").then((value) => {
    try {
      return validateNavSnapshot(value, supabaseEnv);
    } catch (error) {
      demoteSurface("nav");
      throw error;
    }
  });
  runtime.nav = { promise, at: now };
  return promise;
}

/** True when the snapshot covers this surface; a missing key means the Worker predates it. */
export function snapshotHasSurface(snapshot: NavSnapshot, id: string): id is NavTableSurfaceId {
  return NAV_TABLE_SURFACES.some((surface) => surface.id === id)
    && Object.prototype.hasOwnProperty.call(snapshot.latest, id);
}

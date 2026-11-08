import type { ApiSurfaceGroup, SurfacePath } from "../../src/lib/api-surfaces";
import type { ApiFlagDecision, FlagsEnv } from "./flags";

export type { SurfacePath };

/**
 * API_PATH_DEFAULT (plan 7.2: when the flags cannot be read, the Worker env default, the step's
 * safe side): the path of a routed group whose `path.<group>` row is missing or unknown, or whose
 * flags this isolate cannot read. "api" only when set to exactly that; unset (today) is legacy.
 * It goes to api, with the browser's NEXT_PUBLIC_API_PATH_DEFAULT, before the direct writes are
 * closed (docs/supabase-exit/STEP4_WRITE_GATE.md 7).
 */
export function defaultSurfacePath(env: FlagsEnv): SurfacePath {
  return env.API_PATH_DEFAULT === "api" ? "api" : "legacy";
}

/**
 * An /api flags decision with the env default in place of a failed or timed-out read: with
 * API_PATH_DEFAULT=api every routed group is api, so a D1 outage does not send the browser to the
 * closed direct writes. The kill switch (off, not_configured) is never overridden.
 */
export function withPathDefault(
  env: FlagsEnv,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  decision: ApiFlagDecision,
): ApiFlagDecision {
  if (decision.ok || decision.reason !== "unknown" || defaultSurfacePath(env) !== "api") return decision;
  // Shaped like a read that found no rows (empty `values`): every other flag keeps its own default.
  const fallback = { ok: true as const, groups: routedGroups, prefetched: [], shadow: new Map(), values: new Map<string, string>() };
  return fallback;
}

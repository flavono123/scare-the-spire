/**
 * Rules for the few Supabase reads baked into static pages at build time. A
 * hung database once stretched `patch:build` from 2 to 53 minutes (the deploy
 * job limit is 60) and shipped sample posts with nothing in the log.
 */

const DEFAULT_BUILD_QUERY_TIMEOUT_MS = 30_000;

export const BUILD_WITHOUT_SUPABASE_ENV = "ALLOW_BUILD_WITHOUT_SUPABASE";

/** Abort signal for one build-time query. */
export function buildQuerySignal(): AbortSignal {
  const configured = Number(process.env.BUILD_SUPABASE_TIMEOUT_MS);
  return AbortSignal.timeout(configured > 0 ? configured : DEFAULT_BUILD_QUERY_TIMEOUT_MS);
}

function isProductionBuild(): boolean {
  return process.env.NEXT_PUBLIC_SUPABASE_ENV === "production" && process.env.NODE_ENV !== "development";
}

function describeCause(cause: unknown): string {
  if (typeof cause === "string") return cause;
  const message = (cause as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : String(cause);
}

/**
 * A production build stops here: the failed deploy leaves the live pages in
 * place, while a finished one would replace real posts with fallback data.
 * Other builds, and a production build with the override set, log and go on.
 */
export function reportBuildDataFailure(source: string, cause: unknown): void {
  const message = `[build-data] ${source}: could not read real data from Supabase (${describeCause(cause)}).`;
  if (isProductionBuild() && process.env[BUILD_WITHOUT_SUPABASE_ENV] !== "1") {
    console.error(`${message} Failing this production build so fallback posts cannot ship. Set ${BUILD_WITHOUT_SUPABASE_ENV}=1 to release during an outage.`);
    throw new Error(message);
  }
  console.error(`${message} THIS BUILD CONTAINS FALLBACK DATA.`);
}

import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin";

/**
 * Rules for the few reads baked into static pages at build time: the shell
 * patch reels. They read the deployed site's own same-origin /api, the routes
 * the browser reads, never a database (docs/SUPABASE_EXIT_PLAN.md step 6,
 * decision D1 option B). A hung database once stretched `patch:build` from 2
 * to 53 minutes (the deploy job limit is 60) and shipped sample posts with
 * nothing in the log, so every read has a deadline and a production build
 * stops instead of shipping fallback data.
 */

const DEFAULT_BUILD_QUERY_TIMEOUT_MS = 30_000;

export const BUILD_WITHOUT_API_ENV = "ALLOW_BUILD_WITHOUT_API";
/** The name from before the reads moved to /api, still accepted: the deploy workflow sets it. */
export const BUILD_WITHOUT_API_ENV_ALIAS = "ALLOW_BUILD_WITHOUT_SUPABASE";

/** Points the build's own data env at another deployment (a local `wrangler dev`, a spec server). */
export const BUILD_API_ORIGIN_ENV = "BUILD_API_ORIGIN";

export const PRODUCTION_SITE_ORIGIN = DEFAULT_SITE_ORIGIN;
export const TESTBED_SITE_ORIGIN = "https://scare-the-spire-testbed.flavono123.workers.dev";

/** Same header names as workers/api/http.ts. */
const API_MARKER_HEADER = "X-Slseoun-Api";
const API_ENV_HEADER = "X-Slseoun-Api-Env";

/** The data env this build bakes (NEXT_PUBLIC_SUPABASE_ENV keeps its name until step 7). */
export function buildDataEnv(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production";
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

/**
 * The deployment whose /api answers for `dataEnv`: production is the site
 * (NEXT_PUBLIC_SITE_ORIGIN, which CI sets, or the default origin), development
 * is the testbed. Null for any other env.
 */
export function buildApiOrigin(dataEnv: string): string | null {
  const override = dataEnv === buildDataEnv() ? normalizeOrigin(process.env[BUILD_API_ORIGIN_ENV]) : null;
  if (override) return override;
  if (dataEnv === "production") return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN) ?? PRODUCTION_SITE_ORIGIN;
  if (dataEnv === "development") return TESTBED_SITE_ORIGIN;
  return null;
}

/** Abort signal for one build-time read; it covers the response body too. */
export function buildQuerySignal(): AbortSignal {
  const configured = Number(process.env.BUILD_API_TIMEOUT_MS);
  return AbortSignal.timeout(configured > 0 ? configured : DEFAULT_BUILD_QUERY_TIMEOUT_MS);
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown } | null;
    return typeof body?.error === "string" ? body.error : `http_${response.status}`;
  } catch {
    return `http_${response.status}`;
  }
}

/**
 * One GET of `pathAndQuery` from the deployment that serves `dataEnv`. Only a
 * router answer for that env counts: no answer in time, a response without the
 * router marker, any non-2xx (409 surface_legacy included) and another env's
 * answer all throw. Rows come back as the browser gets them: PostgREST's array
 * for passthrough routes, the `{ v: 1, env, ... }` envelope for the rest.
 */
export async function fetchBuildApi(dataEnv: string, pathAndQuery: string): Promise<unknown> {
  if (!pathAndQuery.startsWith("/api/")) throw new Error(`build api path must be absolute: ${pathAndQuery}`);
  const origin = buildApiOrigin(dataEnv);
  if (!origin) throw new Error(`no site origin serves data env "${dataEnv}"`);
  const url = `${origin}${pathAndQuery}`;
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: buildQuerySignal() });
  if (response.headers.get(API_MARKER_HEADER) !== "1") {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`${url} answered ${response.status} without the API marker`);
  }
  if (!response.ok) throw new Error(`${url} answered ${response.status} ${await errorCode(response)}`);
  const body: unknown = await response.json();
  const answeredEnv = Array.isArray(body)
    ? response.headers.get(API_ENV_HEADER)
    : (body as { env?: unknown } | null)?.env;
  if (answeredEnv !== dataEnv) {
    throw new Error(`${url} answered for data env "${String(answeredEnv)}", not "${dataEnv}"`);
  }
  return body;
}

function isProductionBuild(): boolean {
  return process.env.NEXT_PUBLIC_SUPABASE_ENV === "production" && process.env.NODE_ENV !== "development";
}

function buildWithoutApiAllowed(): boolean {
  return process.env[BUILD_WITHOUT_API_ENV] === "1" || process.env[BUILD_WITHOUT_API_ENV_ALIAS] === "1";
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
  const message = `[build-data] ${source}: could not read real data from the site API (${describeCause(cause)}).`;
  if (isProductionBuild() && !buildWithoutApiAllowed()) {
    console.error(`${message} Failing this production build so fallback posts cannot ship. Set ${BUILD_WITHOUT_API_ENV}=1 to release during an outage.`);
    throw new Error(message);
  }
  console.error(`${message} THIS BUILD CONTAINS FALLBACK DATA.`);
}

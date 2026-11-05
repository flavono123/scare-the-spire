import type { ApiSurfaceGroup } from "../../src/lib/api-surfaces";
import { redactPathname } from "../path-redaction";
import type { D1Database, D1PreparedStatement } from "./d1";
import { qaOverride } from "./flag-cookie";
import { apiFlags, flagsDisabledReason, type ExecutionContextLike, type FlagsEnv } from "./flags";
import {
  API_MARKER_HEADER,
  apiError,
  legacyResponse,
  withoutBody,
  type ApiErrorCode,
  type LegacyReason,
} from "./http";
import { bearerToken, checkSupabaseAccessToken, fetchSupabaseJwks, type VerifiedSupabaseUser } from "./jwt";
import { clientIp, withinRateLimit, type RateLimitEnv, type RateLimitKind } from "./rate-limit";
import { supabaseApiConfig, supabaseIssuer, type SupabaseApiConfig } from "./supabase-rest";

/**
 * The same-origin API router (docs/supabase-exit/STEP1_DESIGN.md 4). It owns
 * /api/read/, /api/me/ and /api/write/; everything else under /api keeps its
 * current handler. Order of checks: route, method, cross-site, query, kill
 * switch, QA, flag, token, rate limit, body, handler.
 */

export type ApiEnv = FlagsEnv & RateLimitEnv;

type BaseContext = {
  request: Request;
  url: URL;
  env: ApiEnv;
  ctx: ExecutionContextLike;
  config: SupabaseApiConfig;
  now: number;
  /** False for HEAD: answer from caches only, never call Supabase. */
  allowUpstream: boolean;
  /** Results of the route's `prefetch` statements when they rode with the flags read. */
  prefetched: unknown[][] | null;
  db: D1Database | null;
};

export type PublicRouteContext = BaseContext;
export type UserRouteContext = BaseContext & {
  user: VerifiedSupabaseUser;
  token: string;
  /** The parsed JSON body when the route declares `body`; otherwise undefined. */
  body: unknown;
};

type QuerySchema = Record<string, (value: string) => boolean>;

type RouteBase = {
  /** Stable id for logs. */
  id: string;
  path: string;
  group: ApiSurfaceGroup;
  query?: QuerySchema;
  /**
   * Counted by client IP (public) or verified user (me, write). Public routes
   * served from a cache leave it unset; user routes default to "user".
   */
  rateLimit?: RateLimitKind | "none";
};

export type PublicRoute = RouteBase & {
  method: "GET";
  access: "public";
  /** D1 statements to send in the same batch as the flags read. */
  prefetch?: (db: D1Database) => D1PreparedStatement[];
  handle(context: PublicRouteContext): Promise<Response>;
};

export type UserRoute = RouteBase & {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  access: "me" | "write";
  /** A JSON body of at most `maxBytes`, counted on the stream. */
  body?: { maxBytes: number };
  handle(context: UserRouteContext): Promise<Response>;
};

export type ApiRoute = PublicRoute | UserRoute;

const ROUTER_PREFIXES = ["/api/read/", "/api/me/", "/api/write/"];

export function isApiRouterPath(pathname: string): boolean {
  return ROUTER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function log(method: string, label: string, status: number, code: string): void {
  // Never log headers, tokens, user ids, bodies, or PostgREST messages (STEP1_DESIGN 4.5).
  console.log(`api ${method} ${label} ${status} ${code}`);
}

/** Writes from another site are refused; requests with neither header (old browsers) pass. */
export function isCrossSiteWrite(request: Request, url: URL): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return true;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== url.origin;
}

function validQuery(url: URL, schema: QuerySchema | undefined): boolean {
  const seen = new Set<string>();
  for (const [name, value] of url.searchParams) {
    if (seen.has(name)) return false;
    seen.add(name);
    const check = schema?.[name];
    if (!check || !check(value)) return false;
  }
  return true;
}

function allowHeader(routes: readonly ApiRoute[]): string {
  const methods = new Set<string>(["OPTIONS"]);
  for (const route of routes) {
    methods.add(route.method);
    if (route.method === "GET") methods.add("HEAD");
  }
  return [...methods].join(", ");
}

type BodyRead = { ok: true; value: unknown } | { ok: false; code: "invalid" | "too_large" };

/** Reads a JSON body, counting bytes as they arrive so a lying Content-Length cannot pass. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyRead> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(type)) return { ok: false, code: "invalid" };
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, code: "too_large" };
  if (!request.body) return { ok: false, code: "invalid" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      void reader.cancel().catch(() => undefined);
      return { ok: false, code: "too_large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { ok: false, code: "invalid" };
  }
}

const TOKEN_ERRORS: Record<"expired" | "invalid" | "unavailable", ApiErrorCode> = {
  expired: "token_expired",
  invalid: "token_invalid",
  unavailable: "auth_unavailable",
};

export function createApiRouter(routes: readonly ApiRoute[]) {
  const routedGroups: ReadonlySet<ApiSurfaceGroup> = new Set(routes.map((route) => route.group));

  async function dispatch(request: Request, env: ApiEnv, ctx: ExecutionContextLike, url: URL): Promise<{ response: Response; label: string; code: string }> {
    const forPath = routes.filter((route) => route.path === url.pathname);
    const label = forPath[0]?.id ?? redactPathname(url.pathname);
    const legacy = (reason: LegacyReason) => ({ response: legacyResponse(reason), label, code: `legacy:${reason}` });
    const error = (code: ApiErrorCode, headers?: Record<string, string>) => ({ response: apiError(code, headers), label, code });

    if (forPath.length === 0) return legacy("no_route");
    if (request.method === "OPTIONS") {
      return {
        response: new Response(null, { status: 204, headers: { Allow: allowHeader(forPath), [API_MARKER_HEADER]: "1", "Cache-Control": "private, no-store" } }),
        label,
        code: "options",
      };
    }
    const isHead = request.method === "HEAD";
    const method = isHead ? "GET" : request.method;
    const route = forPath.find((candidate) => candidate.method === method);
    if (!route) return error("method_not_allowed", { Allow: allowHeader(forPath) });
    if (method !== "GET" && isCrossSiteWrite(request, url)) return error("cross_site");
    if (!validQuery(url, route.query)) return error("invalid");

    const disabled = flagsDisabledReason(env);
    if (disabled) return legacy(disabled);
    const qa = qaOverride(request, env);
    if (qa.noSupabase) return legacy("qa");

    let prefetched: unknown[][] | null = null;
    if (qa.forcedGroups) {
      if (!qa.forcedGroups.has(route.group)) return legacy("flag");
    } else {
      const decision = await apiFlags(
        env,
        ctx,
        routedGroups,
        route.access === "public" && route.prefetch ? route.prefetch : undefined,
      );
      if (!decision.ok) return legacy(decision.reason === "unknown" ? "flag" : decision.reason);
      if (!decision.groups.has(route.group)) return legacy("flag");
      prefetched = route.access === "public" && route.prefetch ? decision.prefetched as unknown[][] : null;
      if (prefetched && prefetched.length === 0) prefetched = null;
    }

    const config = supabaseApiConfig(env) as SupabaseApiConfig;
    const base: BaseContext = {
      request,
      url,
      env,
      ctx,
      config,
      now: Date.now(),
      allowUpstream: !isHead,
      prefetched,
      db: env.DB ?? null,
    };

    let response: Response;
    if (route.access === "public") {
      if (route.rateLimit === "ip" && !(await withinRateLimit(env, "ip", clientIp(request)))) {
        return error("rate_limited");
      }
      response = await route.handle(base);
    } else {
      const token = bearerToken(request);
      if (!token) return error("token_invalid");
      const issuer = supabaseIssuer(config);
      const check = await checkSupabaseAccessToken(token, {
        issuer,
        fetchJwks: () => fetchSupabaseJwks(issuer),
        waitUntil: (promise) => ctx.waitUntil(promise),
      });
      if (!check.ok) return error(TOKEN_ERRORS[check.reason]);
      if (route.rateLimit !== "none" && !(await withinRateLimit(env, "user", check.user.userId))) {
        return error("rate_limited");
      }
      let body: unknown;
      if (route.body) {
        const read = await readJsonBody(request, route.body.maxBytes);
        if (!read.ok) return error(read.code);
        body = read.value;
      }
      response = await route.handle({ ...base, user: check.user, token, body });
    }
    return { response: isHead ? withoutBody(response) : response, label, code: "handler" };
  }

  return {
    routedGroups,
    async handle(request: Request, env: ApiEnv, ctx: ExecutionContextLike, url = new URL(request.url)): Promise<Response> {
      let result: { response: Response; label: string; code: string };
      try {
        result = await dispatch(request, env, ctx, url);
      } catch {
        log(request.method, redactPathname(url.pathname), 503, "exception");
        return apiError("unavailable");
      }
      if (result.response.status >= 300) log(request.method, result.label, result.response.status, result.code);
      return result.response;
    },
  };
}

/**
 * Runs one step-1 read route twice for the shadow specs: the real handler against the PostgREST
 * stand-in (the Supabase side, read the way the shadow hook reads it) and the route's D1 adapter
 * against the D1 stand-in, then the design-6 comparison and a key-order check.
 */
import { D1_ADAPTERS } from "../../workers/api/d1-adapters";
import { materialize } from "../../workers/api/d1-adapters/rows";
import type { ApiRoute, PublicRouteContext, UserRouteContext } from "../../workers/api/router";
import { API_ROUTES } from "../../workers/api/routes";
import { resetNavForTest } from "../../workers/api/routes/nav";
import { compareShadow, readCappedJson, type ShadowOutcome } from "../../workers/api/shadow/shadow";
import { SHADOW_SPECS, type ShadowContext, type SupabaseSide } from "../../workers/api/shadow/specs";
import type { SupabaseApiConfig } from "../../workers/api/supabase-rest";
import type { SqliteD1 } from "./d1-shim";
import { TEST_SUPABASE_URL, testToken } from "./fake-postgrest";

export class Ctx {
  pending: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise);
  }
  async drain() {
    while (this.pending.length) await Promise.allSettled(this.pending.splice(0));
  }
}

const ROUTES = new Map<string, ApiRoute>(API_ROUTES.map((route) => [route.id, route]));

export type CaseRun = {
  status: number;
  side: SupabaseSide;
  shadow: ShadowContext;
  outcome: ShadowOutcome | null;
};

export function harness(d1: SqliteD1, config: SupabaseApiConfig) {
  function contextFor(routeId: string, query: string, userId: string | null, ctx = new Ctx()) {
    const route = ROUTES.get(routeId);
    if (!route) throw new Error(`no route ${routeId}`);
    const url = new URL(`https://testbed.example${route.path}${query ? `?${query}` : ""}`);
    const base: PublicRouteContext = {
      request: new Request(url),
      url,
      env: { DB: d1, API_RUNTIME_FLAGS: "d1", API_SUPABASE_URL: TEST_SUPABASE_URL, API_SUPABASE_KEY: config.key, API_DATA_ENV: config.dataEnv },
      ctx,
      config,
      now: Date.now(),
      allowUpstream: true,
      prefetched: null,
      db: d1,
    };
    const context: PublicRouteContext | UserRouteContext = userId
      ? { ...base, user: { userId, isAnonymous: true, expiresAt: Date.now() + 3_600_000 }, token: testToken(userId), body: undefined, bodyStream: null }
      : base;
    return { route, context, ctx };
  }

  /** The Supabase side as the shadow hook gets it: the spec's own read, or a copy of the route's answer. */
  async function supabaseSide(routeId: string, query: string, userId: string | null): Promise<{ side: SupabaseSide; shadow: ShadowContext; status: number }> {
    resetNavForTest();
    const { route, context, ctx } = contextFor(routeId, query, userId);
    const response = await (route.handle as (c: PublicRouteContext | UserRouteContext) => Promise<Response>)(context);
    const shadow: ShadowContext = {
      routeId,
      url: context.url,
      config,
      db: d1,
      userId: "user" in context ? context.user.userId : null,
      now: context.now,
    };
    const own = SHADOW_SPECS[routeId].supabase?.(shadow) ?? null;
    const side = own ? await own : await readCappedJson(response.clone(), Number.MAX_SAFE_INTEGER);
    void response.body?.cancel().catch(() => undefined);
    await ctx.drain();
    return { side, shadow, status: response.status };
  }

  /** Both prepared answers (the comparison's inputs), for key-order checks. */
  async function preparedPair(routeId: string, side: SupabaseSide & { ok: true }, shadow: ShadowContext) {
    const spec = SHADOW_SPECS[routeId];
    const supabase = spec.prepareSupabase ? spec.prepareSupabase(side.answer, shadow) : side.answer;
    const adapterContext = { db: d1, dataEnv: config.dataEnv, url: shadow.url, userId: shadow.userId, now: shadow.now };
    let d1Value = materialize(spec.d1 ? await spec.d1(adapterContext, side.answer) : await D1_ADAPTERS[routeId](adapterContext));
    if (spec.prepareD1) d1Value = spec.prepareD1(d1Value, supabase, shadow);
    return { supabase, d1: d1Value };
  }

  async function run(routeId: string, query: string, userId: string | null): Promise<CaseRun> {
    const { side, shadow, status } = await supabaseSide(routeId, query, userId);
    const outcome = status === 200 ? await compareShadow(SHADOW_SPECS[routeId], shadow, side) : null;
    return { status, side, shadow, outcome };
  }

  return { contextFor, supabaseSide, preparedPair, run };
}

/** Object key lists of the rows at `path` ("" the answer, "a.b", "*" every object value). */
export function keysAt(value: unknown, path: string): string[][] {
  const segments = path === "" ? [] : path.split(".");
  let nodes: unknown[] = [value];
  for (const segment of segments) {
    nodes = nodes.flatMap((node) => {
      if (!node || typeof node !== "object") return [];
      if (segment === "*") return Object.values(node);
      return [(node as Record<string, unknown>)[segment]];
    });
  }
  return nodes
    .flatMap((node) => (Array.isArray(node) ? node : []))
    .filter((row) => row && typeof row === "object")
    .map((row) => Object.keys(row));
}

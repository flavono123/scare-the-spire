import { D1_ADAPTERS } from "./d1-adapters";
import { AdapterInputError, answerText, TextBody, type AdapterContext } from "./d1-adapters/rows";
import { withTimeout } from "./d1";
import { API_MARKER_HEADER, apiError, PRIVATE_NO_STORE, textResponse } from "./http";
import type { D1ReadEvent } from "./router";
import { HANDLER_BUDGET_MS } from "./routes/comments";
import { NAV_CACHE_CONTROL, NAV_MEMORY_MS } from "./routes/nav";

/**
 * Step 3 reads from D1 (docs/SUPABASE_EXIT_PLAN.md 7.3 step 3). For a GET route whose group reads
 * from D1 (flags.ts readStoreFor) the router calls d1ReadAnswer in place of the route's handler,
 * after the same query, rate-limit and identity checks. The answer is the route's D1 adapter
 * (workers/api/d1-adapters, equal to the Supabase answer by the step 2 shadow comparison) with the
 * headers the route's Supabase answer carries:
 * - a bare array is PostgREST's body passed through on the Supabase side (passthroughJson, streamed
 *   rows): JSON, private no-store, X-Slseoun-Api-Env;
 * - an object is a `{v, env, ...}` envelope (jsonResponse): JSON, private no-store unless the route
 *   caches (nav: public, max-age=30);
 * - TextBody is the run raw file (R3r): text/plain, as the Supabase handler streams it.
 * The nav answer is also kept in isolate memory for NAV_MEMORY_MS, like the Supabase handler's.
 *
 * Failures: with read.<group> = d1 (Supabase still the source) a D1 error or timeout answers this
 * request from the route's own handler and logs one line; an input the adapter cannot bind goes to
 * the route's handler too (it answers as today). With source.<group> = d1 (D1 the origin) nothing
 * goes to Supabase: a D1 error is the 503 a Supabase failure gives, an input error the 400.
 */

/** While Supabase is the source, a slow D1 gives way to the route's own handler after this long. */
export const D1_READ_FALLBACK_MS = 2_000;
/** D1 as the origin waits as long as a Supabase handler does. */
export const D1_READ_ORIGIN_MS = HANDLER_BUDGET_MS;

const CACHE_CONTROL: Readonly<Record<string, string>> = { "read.nav": NAV_CACHE_CONTROL };
const MEMORY_MS: Readonly<Record<string, number>> = { "read.nav": NAV_MEMORY_MS };
const MEMORY_MAX_ENTRIES = 8;

type Answer = { kind: "rows" | "envelope" | "text"; text: string };

let memory = new Map<string, { answer: Answer; env: string; at: number }>();

export function resetD1ReadForTest(): void {
  memory = new Map();
}

function toAnswer(value: unknown): Answer {
  if (value instanceof TextBody) return { kind: "text", text: value.text };
  return { kind: Array.isArray(value) ? "rows" : "envelope", text: answerText(value) };
}

function respond(routeId: string, answer: Answer, env: string): Response {
  if (answer.kind === "text") return textResponse(answer.text, env);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": CACHE_CONTROL[routeId] ?? PRIVATE_NO_STORE,
    "X-Robots-Tag": "noindex",
    [API_MARKER_HEADER]: "1",
  };
  if (answer.kind === "rows") headers["X-Slseoun-Api-Env"] = env;
  return new Response(answer.text, { status: 200, headers });
}

function log(routeId: string, outcome: string): void {
  // Route ids only: never rows, ids, query strings or error messages (STEP1_DESIGN 4.5).
  console.log(`api d1read ${routeId} ${outcome}`);
}

function userIdOf(context: D1ReadEvent["context"]): string | null {
  return "user" in context && typeof context.user?.userId === "string" ? context.user.userId : null;
}

export async function d1ReadAnswer(event: D1ReadEvent): Promise<Response> {
  const { route, context, store } = event;
  const origin = store === "d1-origin";
  const adapter = D1_ADAPTERS[route.id];
  const db = context.db;
  if (!adapter || !db) {
    log(route.id, origin ? "unavailable:no_d1" : "fallback:no_d1");
    return origin ? apiError("unavailable") : event.supabase();
  }
  const env = context.config.dataEnv;
  const memoryMs = MEMORY_MS[route.id];
  const key = `${route.id}${context.url.search}`;
  if (memoryMs) {
    const hit = memory.get(key);
    if (hit && hit.env === env && context.now - hit.at < memoryMs) return respond(route.id, hit.answer, env);
  }
  const adapterContext: AdapterContext = { db, dataEnv: env, url: context.url, userId: userIdOf(context), now: context.now };
  let answer: Answer;
  try {
    answer = toAnswer(await withTimeout(adapter(adapterContext), origin ? D1_READ_ORIGIN_MS : D1_READ_FALLBACK_MS));
  } catch (error) {
    if (error instanceof AdapterInputError) return origin ? apiError("invalid") : event.supabase();
    log(route.id, origin ? "unavailable" : "fallback");
    return origin ? apiError("unavailable") : event.supabase();
  }
  if (memoryMs) {
    if (memory.size >= MEMORY_MAX_ENTRIES) memory = new Map();
    memory.set(key, { answer, env, at: context.now });
  }
  return respond(route.id, answer, env);
}

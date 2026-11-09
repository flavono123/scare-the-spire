import {
  postgrest,
  postgrestStream,
  type RestRequest,
  type RestResult,
  type StreamRequest,
  type StreamResult,
  type SupabaseApiConfig,
  type WriteGateHook,
} from "../supabase-rest";
import type { GateDecision, GateWrite } from "./decide";
import { supabaseServiceConfig, WORKER_ACTOR_TOKEN, withWriteGate, type WriteGateEnv } from "./gate";
import { TABLE_RULES } from "./rules";

/**
 * Personal reads (`/api/me/*`) of a user the Worker knows only by the signed cookie (plan 5.3), while
 * Supabase is still the origin (docs/supabase-exit/STEP4_WRITE_GATE.md 10.1). In cookie mode the browser
 * sends no Supabase token, so the me handlers' PostgREST calls would reach Supabase as anon. Like the
 * write gate, the handlers keep building their calls; the calls that carry the user's identity come here
 * and go out with the service key, limited the way Supabase limits that user's token today:
 *
 * - a table read keeps its query; on a table whose SELECT policy shows the owner's rows only
 *   (TABLE_RULES `select: "owner"`) the owner filter `owner=eq.<uid>` is added, which is that policy.
 *   Column grants (contact_inquiries) apply to the select list, filters and order as in Postgres (42501).
 *   Embedded tables must be readable by everyone (comments of comment_likes).
 * - an RPC that reads auth.uid() goes to its service-only wrapper with `p_actor = uid`
 *   (supabase/migrations/20261109150000_worker_read_actor.sql), so its result is exactly today's.
 * - anything else (writes, logical filters, unknown tables or RPCs) is not sent: 500 gate_unsupported.
 *
 * The user's token path is unchanged: a request that still carries a token for the cookie's uid (older
 * JS), or any request in token mode, reads with that token and RLS as before.
 */

/** RPCs of the me routes that read auth.uid(), and their service-only wrappers. */
export const ACTOR_READ_RPCS: Readonly<Record<string, string>> = {
  get_my_profile_activity_stats: "worker_get_my_profile_activity_stats",
  get_my_profile_activity: "worker_get_my_profile_activity",
  get_puzzlebox_leaderboard: "worker_get_puzzlebox_leaderboard",
  get_my_puzzlebox_standings: "worker_get_my_puzzlebox_standings",
};

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const RESERVED = new Set(["select", "order", "limit", "offset"]);

const reject = (status: number, code: string): GateDecision => ({ kind: "reject", status, code });
const unsupported = (): GateDecision => reject(500, "gate_unsupported");
const forbidden = (): GateDecision => reject(403, "42501");

type SelectItem = { column: string } | { embed: string; columns: string[] };

/** A flat select list with one level of `table(cols)` / `table!hint(cols)` embeds; null for anything else. */
function parseSelect(select: string): SelectItem[] | null {
  const items: SelectItem[] = [];
  let depth = 0;
  let current = "";
  const parts: string[] = [];
  for (const char of select.replace(/\s+/g, "")) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0 || depth > 1) return null;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  if (depth !== 0) return null;
  parts.push(current);
  for (const part of parts) {
    if (part === "*" || IDENTIFIER.test(part)) {
      items.push({ column: part });
      continue;
    }
    const embed = /^([a-z_][a-z0-9_]*)(?:!(?:inner|[a-z_][a-z0-9_]*))?\(([^()]*)\)$/.exec(part);
    if (!embed) return null;
    const columns = embed[2].split(",");
    if (!columns.every((column) => IDENTIFIER.test(column))) return null;
    items.push({ embed: embed[1], columns });
  }
  return items;
}

function decideTableRead(read: GateWrite, actor: string): GateDecision {
  const rule = TABLE_RULES[read.path];
  if (!rule) return unsupported();
  const items = parseSelect(read.query.get("select") ?? "*");
  if (!items) return unsupported();
  const embeds = new Set<string>();
  for (const item of items) {
    if (!("embed" in item)) continue;
    const embedded = TABLE_RULES[item.embed];
    // Only embeds every authenticated user may read in full: no owner filter or column grant to apply.
    if (!embedded || embedded.select !== "public" || embedded.grants?.select) return unsupported();
    embeds.add(item.embed);
  }
  const filters: string[] = [];
  for (const key of read.query.keys()) {
    if (RESERVED.has(key)) continue;
    // `or`, `and` and `not.or` keys are logical filters, never a column: not sent.
    const [first, second, extra] = key.split(".");
    if (extra !== undefined) return unsupported();
    if (second === undefined) {
      if (!IDENTIFIER.test(first) || first === "or" || first === "and" || first === "not") return unsupported();
      filters.push(first);
    } else if (!embeds.has(first) || !IDENTIFIER.test(second)) {
      return unsupported();
    }
  }
  const order = (read.query.get("order") ?? "").split(",").filter(Boolean).map((term) => term.split(".")[0]);
  if (!order.every((column) => IDENTIFIER.test(column))) return unsupported();

  // Column grants: Postgres checks every column the statement reads.
  const granted = rule.grants?.select;
  if (granted) {
    const selected = items.flatMap((item) => ("column" in item ? [item.column] : []));
    if (selected.includes("*") || items.some((item) => "embed" in item)) return forbidden();
    if (![...selected, ...filters, ...order].every((column) => granted.includes(column))) return forbidden();
  }

  const query = new URLSearchParams(read.query);
  // The owner-only SELECT policy, as a filter; the service role reads past RLS.
  if (rule.select === "owner") query.append(rule.owner, `eq.${actor}`);
  return { kind: "send", write: { ...read, query, body: undefined } };
}

/** How a me handler's call goes out with the service key, or why it does not. */
export function decideMeRead(read: GateWrite, actor: string): GateDecision {
  if (read.path.startsWith("rpc/")) {
    const wrapper = ACTOR_READ_RPCS[read.path.slice(4)];
    if (read.method !== "POST" || !wrapper) return unsupported();
    const args = read.body === undefined ? {} : read.body;
    if (!args || typeof args !== "object" || Array.isArray(args)) return unsupported();
    // PostgREST would find no function with that argument: the same answer as the write gate's RPCs.
    if (Object.hasOwn(args, "p_actor")) return reject(404, "PGRST202");
    return { kind: "send", write: { ...read, path: `rpc/${wrapper}`, body: { ...args, p_actor: actor } } };
  }
  if (read.method !== "GET" && read.method !== "HEAD") return unsupported();
  return decideTableRead(read, actor);
}

function gateRead(request: RestRequest | StreamRequest): GateWrite {
  return {
    method: request.method ?? "GET",
    path: request.path,
    query: new URLSearchParams(request.query ?? undefined),
    prefer: request.prefer ?? [],
    body: request.body,
  };
}

/** The decision to send, or the PostgREST-shaped failure the handler maps like any other (logged). */
function decided(read: GateWrite, actor: string): { ok: true; write: GateWrite } | { ok: false; status: number; code: string } {
  const decision = decideMeRead(read, actor);
  if (decision.kind === "send") return { ok: true, write: decision.write };
  const { status, code } = decision.kind === "reject" ? decision : { status: 500, code: "gate_unsupported" };
  // Never log filters, bodies or user ids (STEP1_DESIGN 4.5).
  console.log(`api me-read-gate ${read.method} ${read.path} ${status} ${code}`);
  return { ok: false, status, code };
}

export function createMeReadGate(options: { actor: string; service: SupabaseApiConfig }): WriteGateHook {
  const { actor, service } = options;
  return {
    async postgrest(request: RestRequest): Promise<RestResult<unknown>> {
      const decision = decided(gateRead(request), actor);
      if (!decision.ok) return decision;
      const { method, path, query, body } = decision.write;
      return postgrest(service, { ...request, token: null, method: method as RestRequest["method"], path, query, body });
    },
    async stream(request: StreamRequest): Promise<StreamResult> {
      // Me reads have no upload body; a passed-through one is no read.
      if (request.bodyStream) return { ok: false, status: 500, code: "gate_unsupported" };
      const decision = decided(gateRead(request), actor);
      if (!decision.ok) return decision;
      const { method, path, query, body } = decision.write;
      return postgrestStream(service, { ...request, token: null, method: method as StreamRequest["method"], path, query, body });
    },
  };
}

/**
 * The router's hook for /api/me routes whose identity has no Supabase token (the signed cookie alone):
 * the handler's config with the read gate in front and the placeholder token. Null without the service
 * key, which leaves the handler as it is (the call then reaches Supabase as anon, as before).
 */
export function meReadContext(
  env: WriteGateEnv,
  config: SupabaseApiConfig,
  actor: string,
): { config: SupabaseApiConfig; token: string } | null {
  const service = supabaseServiceConfig(env, config);
  if (!service) return null;
  return { config: withWriteGate(config, createMeReadGate({ actor, service })), token: WORKER_ACTOR_TOKEN };
}

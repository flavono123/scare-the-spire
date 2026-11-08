import type { ApiSurfaceGroup } from "../../../src/lib/api-surfaces";
import type { ExecutionContextLike } from "../flags";
import {
  postgrest,
  postgrestStream,
  READ_TIMEOUT_MS,
  type RestRequest,
  type RestResult,
  type StreamRequest,
  type StreamResult,
  type SupabaseApiConfig,
  type WriteGateHook,
} from "../supabase-rest";
import { writeModeFor, type WriteFlagsEnv } from "../write-flags";
import { decideWrite, type GateDecision, type GateLookups, type GateWrite, type Row } from "./decide";

/**
 * The worker write mode at run time (docs/supabase-exit/STEP4_WRITE_GATE.md 4):
 * the step 1 handlers keep building their PostgREST calls; calls that carry the
 * user's identity come here instead of going out with the user's token. Each is
 * decided by `decideWrite` and, when allowed, sent with the service key.
 */

export type WriteGateEnv = WriteFlagsEnv & {
  /** A Supabase secret key (sb_secret_…), a Worker secret. Without it worker mode stays off. */
  API_SUPABASE_SERVICE_KEY?: string;
};

/**
 * The `token` handlers get in worker mode, in place of the user's token. The
 * gate intercepts calls by it and never sends it, so the user's token never
 * leaves the Worker in worker mode; if it ever reached Supabase, Supabase
 * would refuse it.
 */
export const WORKER_ACTOR_TOKEN = "worker-actor";

/**
 * The uid that owns a worker-mode write: the identity the router resolved for
 * the request. Today that is the verified Supabase access token (the rls path's
 * check); with the signed-cookie identity (plan 5.3) it is whatever the
 * router's identity resolution returns, so this is the one place to point at it.
 */
export function writeActor(user: { userId: string }): string {
  return user.userId;
}

/** Largest JSON body the gate reads from a passed-through upload (run batches are the biggest). */
export const GATE_BODY_MAX_BYTES = 24 * 1024 * 1024;

export function supabaseServiceConfig(env: WriteGateEnv, base: SupabaseApiConfig): SupabaseApiConfig | null {
  const key = (env.API_SUPABASE_SERVICE_KEY ?? "").trim();
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return null;
  return { url: base.url, key, dataEnv: base.dataEnv };
}

let warnedNoKey = false;

/** The service config when this group's writes are in worker mode here, or null for the rls path. */
export async function workerWriteService(
  env: WriteGateEnv,
  ctx: ExecutionContextLike,
  group: ApiSurfaceGroup,
  config: SupabaseApiConfig,
): Promise<SupabaseApiConfig | null> {
  if ((await writeModeFor(env, ctx, group)) !== "worker") return null;
  const service = supabaseServiceConfig(env, config);
  if (!service && !warnedNoKey) {
    warnedNoKey = true;
    console.log("api write-mode worker without API_SUPABASE_SERVICE_KEY: rls");
  }
  return service;
}

function serviceLookups(service: SupabaseApiConfig, deadline: number | undefined): GateLookups {
  return {
    async rows(table, select, filters, limit) {
      const query = new URLSearchParams([["select", select], ...filters, ["limit", String(limit)]]);
      const result = await postgrest<Row[]>(service, { path: table, query, deadline, timeoutMs: READ_TIMEOUT_MS });
      return result.ok ? { ok: true, value: result.data ?? [] } : { ok: false, status: result.status, code: result.code };
    },
    async count(table, filters) {
      const query = new URLSearchParams([["select", "id"], ...filters]);
      const result = await postgrest<null>(service, { method: "HEAD", path: table, query, prefer: ["count=exact"], deadline, timeoutMs: READ_TIMEOUT_MS });
      if (!result.ok) return { ok: false, status: result.status, code: result.code };
      const total = /\/(\d+)$/.exec(result.contentRange ?? "");
      return total ? { ok: true, value: Number(total[1]) } : { ok: false, status: result.status, code: "bad_response" };
    },
  };
}

function gateWrite(request: RestRequest | StreamRequest, body: unknown): GateWrite {
  return {
    method: request.method ?? "GET",
    path: request.path,
    query: new URLSearchParams(request.query ?? undefined),
    prefer: request.prefer ?? [],
    body,
  };
}

/** Reads a passed-through JSON body; the router already held it to its Content-Length cap. */
async function readJson(stream: ReadableStream<Uint8Array>): Promise<{ ok: true; value: unknown } | { ok: false; status: number; code: string }> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > GATE_BODY_MAX_BYTES) {
      void reader.cancel().catch(() => undefined);
      return { ok: false, status: 413, code: "too_large" };
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
    // PostgREST's answer to a body that is not JSON.
    return { ok: false, status: 400, code: "PGRST102" };
  }
}

function logDecision(write: GateWrite, decision: GateDecision): void {
  // Never log bodies, filters or user ids (STEP1_DESIGN 4.5).
  if (decision.kind === "reject") console.log(`api write-gate ${write.method} ${write.path} ${decision.status} ${decision.code}`);
}

export type WriteGateOptions = {
  /** The resolved uid: the owner of every row and `p_actor` of the actor RPCs. */
  actor: string;
  /** Supabase with the service key (no gate of its own). */
  service: SupabaseApiConfig;
  now?: () => number;
};

export function createWriteGate(options: WriteGateOptions): WriteGateHook {
  const { actor, service } = options;
  const now = options.now ?? Date.now;
  return {
    async postgrest(request: RestRequest): Promise<RestResult<unknown>> {
      const write = gateWrite(request, request.body);
      const decision = await decideWrite(write, actor, serviceLookups(service, request.deadline), now());
      logDecision(write, decision);
      if (decision.kind === "reject") return { ok: false, status: decision.status, code: decision.code };
      if (decision.kind === "empty") {
        return { ok: true, status: decision.representation ? 200 : 204, data: decision.representation ? [] : null, contentRange: null };
      }
      const { method, path, query, prefer, body } = decision.write;
      return postgrest(service, { ...request, token: null, method: method as RestRequest["method"], path, query, prefer: [...prefer], body });
    },

    async stream(request: StreamRequest): Promise<StreamResult> {
      let body: unknown = request.body;
      if (request.bodyStream) {
        const read = await readJson(request.bodyStream);
        if (!read.ok) return read;
        body = read.value;
      }
      const write = gateWrite(request, body);
      const decision = await decideWrite(write, actor, serviceLookups(service, request.deadline), now());
      logDecision(write, decision);
      if (decision.kind === "reject") return { ok: false, status: decision.status, code: decision.code };
      if (decision.kind === "empty") {
        const headers = { "Content-Type": "application/json; charset=utf-8" };
        return decision.representation
          ? { ok: true, status: 200, response: new Response("[]", { status: 200, headers }) }
          : { ok: true, status: 204, response: new Response(null, { status: 204 }) };
      }
      const { method, path, query, prefer } = decision.write;
      return postgrestStream(service, {
        ...request,
        token: null,
        bodyStream: null,
        method: method as StreamRequest["method"],
        path,
        query,
        prefer: [...prefer],
        body: decision.write.body,
      });
    },
  };
}

/** The handler config for a worker-mode write: the same project, with the gate in front of user calls. */
export function withWriteGate(config: SupabaseApiConfig, gate: WriteGateHook): SupabaseApiConfig {
  return { ...config, writeGate: gate };
}

/**
 * The router's hook for /api/write routes: in worker mode, the handler's config
 * (gate in front) and token (the placeholder) for writes owned by `actor`; null
 * on the rls path, where the handler gets today's config and the user's token.
 */
export async function workerWriteContext(
  env: WriteGateEnv,
  ctx: ExecutionContextLike,
  group: ApiSurfaceGroup,
  config: SupabaseApiConfig,
  actor: string,
): Promise<{ config: SupabaseApiConfig; token: string } | null> {
  const service = await workerWriteService(env, ctx, group, config);
  if (!service) return null;
  return { config: withWriteGate(config, createWriteGate({ actor, service })), token: WORKER_ACTOR_TOKEN };
}

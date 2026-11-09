/**
 * Server-only (Node) access to the Workers' D1 databases for the operator tools: the /dev pages and
 * /api/dev routes of `next dev`, and the scripts under scripts/admin (docs/SUPABASE_EXIT_PLAN.md 5.7).
 * Never import it from client code: it spawns wrangler.
 *
 * Every call is one `wrangler d1 execute DB --json --command` on the env's database, the way
 * scripts/runtime-flags.ts reads and writes the flags: the operator's own wrangler login (no token
 * in the repo), `--remote` for Cloudflare and `--local` for the `wrangler dev` SQLite under
 * .wrangler/state. The statements of one call are sent as one SQL text, in order: wrangler runs a
 * local call as one D1 batch (one transaction) and sends a remote one to the D1 query API as one
 * request. Parameters are inlined as SQL literals (src/lib/d1-sync/statements.ts toSqlText).
 *
 * D1 environments and their data env (scripts/d1-sync/reconcile.ts TARGETS):
 *   production -> slseoun-prod    (Supabase env production)
 *   testbed    -> slseoun-testbed (Supabase env development)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { toSqlText, type D1Statement } from "../../src/lib/d1-sync/statements";
import { WRITE_PAUSED_KEY } from "../../src/lib/write-source-flags";
import { GATE_SQL, parseGateRows, type WriteGate } from "../../workers/api/d1-write/gate";

export type D1EnvName = "production" | "testbed";
export type D1Mode = "remote" | "local";
export type DataEnv = "production" | "development";

export const D1_ENVS: readonly D1EnvName[] = ["production", "testbed"];
export const D1_DATABASES: Readonly<Record<D1EnvName, string>> = { production: "slseoun-prod", testbed: "slseoun-testbed" };
export const DATA_ENV_OF: Readonly<Record<D1EnvName, DataEnv>> = { production: "production", testbed: "development" };

export function isD1EnvName(value: unknown): value is D1EnvName {
  return value === "production" || value === "testbed";
}

/** The D1 env that holds a Supabase data env's rows, or null for an unknown env. */
export function d1EnvOf(dataEnv: unknown): D1EnvName | null {
  if (dataEnv === "production") return "production";
  if (dataEnv === "development") return "testbed";
  return null;
}

export type D1Rows = Record<string, unknown>[];

export interface D1Remote {
  readonly env: D1EnvName;
  readonly mode: D1Mode;
  /** One call: the statements in order, as one batch. Returns each statement's rows. */
  run(statements: readonly D1Statement[]): Promise<D1Rows[]>;
}

/** Larger SQL would not fit a command line (macOS ARG_MAX is 1 MiB with the environment). */
export const MAX_COMMAND_BYTES = 512 * 1024;
export const WRANGLER_TIMEOUT_MS = 60_000;

export class D1RemoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "D1RemoteError";
  }
}

/** The statements as the one SQL text a call sends. */
export function commandSql(statements: readonly D1Statement[]): string {
  return statements.map((statement) => toSqlText(statement)).join("\n");
}

function wranglerCommand(root: string): { command: string; prefix: string[] } {
  const bin = join(root, "node_modules", ".bin", "wrangler");
  if (existsSync(bin)) return { command: bin, prefix: [] };
  return { command: "pnpm", prefix: ["exec", "wrangler"] };
}

/** First lines of wrangler's error output, without the SQL it was sent. */
function shortError(text: string): string {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const errorLine = lines.find((line) => /error/i.test(line)) ?? lines[0] ?? "no output";
  return errorLine.length > 300 ? `${errorLine.slice(0, 297)}...` : errorLine;
}

/**
 * The D1 database of a Worker env through wrangler. `root` is the repo root (wrangler.jsonc); the
 * default is the working directory, which is the root for `next dev` and `pnpm exec tsx scripts/...`.
 */
export function wranglerD1(env: D1EnvName, mode: D1Mode, options: { root?: string; timeoutMs?: number } = {}): D1Remote {
  const root = options.root ?? process.cwd();
  const timeoutMs = options.timeoutMs ?? WRANGLER_TIMEOUT_MS;
  return {
    env,
    mode,
    async run(statements) {
      if (statements.length === 0) return [];
      if (!existsSync(join(root, "wrangler.jsonc"))) throw new D1RemoteError(`no wrangler.jsonc in ${root}`);
      const sql = commandSql(statements);
      if (Buffer.byteLength(sql, "utf8") > MAX_COMMAND_BYTES) {
        throw new D1RemoteError(`one D1 call is limited to ${MAX_COMMAND_BYTES} bytes of SQL`);
      }
      const { command, prefix } = wranglerCommand(root);
      const args = [...prefix, "d1", "execute", "DB", mode === "remote" ? "--remote" : "--local", "--yes", "--json", "--command", sql];
      if (env === "testbed") args.push("--env", "testbed");
      const { status, stdout, stderr } = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(command, args, {
          cwd: root,
          env: { ...process.env, WRANGLER_WRITE_LOGS: "0", WRANGLER_SEND_METRICS: "false" },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new D1RemoteError(`wrangler d1 execute (${D1_DATABASES[env]}, ${mode}) timed out after ${timeoutMs} ms`));
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
          out += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
          err += String(chunk);
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(new D1RemoteError(`wrangler could not start: ${error.message}`));
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({ status: code, stdout: out, stderr: err });
        });
      });
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        parsed = null;
      }
      if (status !== 0 || !Array.isArray(parsed)) {
        const detail = (parsed as { error?: { text?: string; message?: string } } | null)?.error;
        const message = detail?.text ?? detail?.message ?? shortError(`${stderr}\n${stdout}`);
        throw new D1RemoteError(`wrangler d1 execute (${D1_DATABASES[env]}, ${mode}) failed: ${message}`);
      }
      const results = parsed as Array<{ results?: D1Rows; success?: boolean; error?: string }>;
      if (results.some((entry) => entry?.success === false)) {
        throw new D1RemoteError(`wrangler d1 execute (${D1_DATABASES[env]}, ${mode}) failed: ${results.find((entry) => entry?.success === false)?.error ?? "a statement failed"}`);
      }
      return results.map((entry) => entry?.results ?? []);
    },
  };
}

/** The dev server's D1 mode: remote (Cloudflare) unless ADMIN_D1=local (the `wrangler dev` SQLite). */
export function adminD1Mode(env: NodeJS.ProcessEnv = process.env): D1Mode {
  return env.ADMIN_D1 === "local" ? "local" : "remote";
}

// ------------------------------------------------------------------------------------------- write gate

export class WritesPausedError extends Error {
  constructor(readonly env: D1EnvName) {
    super(`writes are paused on ${D1_DATABASES[env]} (write.paused on, a cutover is running); retry when it is off`);
    this.name = "WritesPausedError";
  }
}

/**
 * The step 5 write gate of an env, read from its D1 runtime_flags with the Worker's own SQL and
 * parser (workers/api/d1-write/gate.ts): a missing or unknown source is supabase. Unlike the Worker,
 * an unreadable gate is an error (nothing is written), never a default.
 */
export async function readGate(d1: D1Remote): Promise<WriteGate> {
  const [rows] = await d1.run([{ sql: GATE_SQL, params: [WRITE_PAUSED_KEY] }]);
  return parseGateRows(rows ?? []);
}

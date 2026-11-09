/**
 * The real stores behind scripts/admin/admin-writes.ts and admin-reads.ts: each env's D1 through
 * wrangler (scripts/lib/d1-remote.ts), Supabase PostgREST with the server's secret key, and the
 * Supabase CLI for the two writes that ran SQL on the linked project (the seed and the skill).
 * Node only: never import it from client code.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { adminD1Mode, wranglerD1, type D1EnvName, type D1Mode, type D1Remote } from "../lib/d1-remote";
import { supabaseAdminConfig } from "../lib/supabase-admin";
import type { AdminDeps } from "./admin-writes";

/** `supabase db query --linked -f <file>`, output shown as the CLI prints it (as the seed and the skill ran it). */
export function supabaseCliRunner(): (sql: string) => Promise<void> {
  return async (sql) => {
    const dir = mkdtempSync(join(tmpdir(), "admin-sql-"));
    const file = join(dir, "query.sql");
    writeFileSync(file, sql);
    try {
      const status = await new Promise<number | null>((resolve, reject) => {
        const child = spawn("supabase", ["db", "query", "--linked", "-f", file], { stdio: "inherit" });
        child.on("error", reject);
        child.on("close", resolve);
      });
      if (status !== 0) throw new Error(`supabase db query failed with status ${status ?? "null"}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

export function adminDeps(options: { mode?: D1Mode; dryRun?: boolean; cli?: boolean; log?: (line: string) => void } = {}): AdminDeps {
  const mode = options.mode ?? adminD1Mode();
  const cache = new Map<D1EnvName, D1Remote>();
  return {
    d1(env) {
      let remote = cache.get(env);
      if (!remote) {
        remote = wranglerD1(env, mode);
        cache.set(env, remote);
      }
      return remote;
    },
    supabase: supabaseAdminConfig(),
    supabaseSql: options.cli ? supabaseCliRunner() : undefined,
    dryRun: options.dryRun,
    localD1: mode === "local",
    log: options.log,
  };
}

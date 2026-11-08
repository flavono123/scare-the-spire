/**
 * Reads the 1-minute sync's window and hands over the first copy's watermark start
 * (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.2 step 7, 5.3): low_watermark = high_seen = L0 - 1.
 *
 * Usage:
 *   tsx scripts/d1-sync-state.ts show --env testbed|production --remote|--local
 *   tsx scripts/d1-sync-state.ts start --l0 <id> --env testbed|production --remote|--local [--confirm-production]
 *
 * start refuses while sync.enabled is on (the cron would race the write) and clears applied_above
 * and the last error. Like scripts/runtime-flags.ts, the target must be named, and production needs
 * --confirm-production after the user approves.
 */
import { spawnSync } from "node:child_process";

type Target = { env: "testbed" | "production"; remote: boolean };

const DATABASES = { testbed: "slseoun-testbed", production: "slseoun-prod" } as const;

function usage(message?: string): never {
  if (message) console.error(message);
  console.error([
    "Usage:",
    "  tsx scripts/d1-sync-state.ts show --env testbed|production --remote|--local",
    "  tsx scripts/d1-sync-state.ts start --l0 <id> --env testbed|production --remote|--local [--confirm-production]",
  ].join("\n"));
  process.exit(2);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function execute(target: Target, sql: string): unknown {
  const args = ["exec", "wrangler", "d1", "execute", "DB", target.remote ? "--remote" : "--local", "--yes", "--json", "--command", sql];
  if (target.env === "testbed") args.push("--env", "testbed");
  const result = spawnSync("pnpm", args, { encoding: "utf8", env: { ...process.env, WRANGLER_WRITE_LOGS: "0" } });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return result.stdout;
  }
}

function rows(output: unknown, index: number): Record<string, unknown>[] {
  if (!Array.isArray(output)) return [];
  const entry = output[index] as { results?: Record<string, unknown>[] } | undefined;
  return entry?.results ?? [];
}

const SHOW =
  "SELECT name, low_watermark, high_seen, json_array_length(applied_above) AS applied, lease_until, last_run_at, " +
  "last_applied_at, last_lag_ms, last_statements, last_subrequests, last_raw_bytes, fail_count, last_error FROM sync_state; " +
  "SELECT value FROM runtime_flags WHERE key = 'sync.enabled'; " +
  "SELECT reason, count(*) AS open FROM sync_rejects WHERE resolved_at IS NULL GROUP BY reason; " +
  "SELECT count(*) AS queued FROM sync_pending_raw;";

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  const [command, ...rest] = argv;
  const env = option(rest, "--env");
  if (env !== "testbed" && env !== "production") usage("--env testbed or --env production is required");
  const remote = rest.includes("--remote");
  const local = rest.includes("--local");
  if (remote === local) usage("name the target: --remote (Cloudflare) or --local (wrangler dev)");
  const target: Target = { env, remote };
  const where = `${DATABASES[env]}${remote ? " (remote)" : " (local)"}`;
  console.log(`target: ${where}`);

  if (command === "show") {
    const output = execute(target, SHOW);
    console.table(rows(output, 0));
    console.log(`sync.enabled: ${String(rows(output, 1)[0]?.value ?? "(unset)")}`);
    console.table(rows(output, 2));
    console.table(rows(output, 3));
    return;
  }

  if (command === "start") {
    const l0 = Number(option(rest, "--l0"));
    if (!Number.isSafeInteger(l0) || l0 < 1) usage("--l0 must be a change-log id >= 1 (L0 = 1 when the log was empty at W0)");
    if (env === "production" && remote && !rest.includes("--confirm-production")) {
      usage("changing production needs --confirm-production (after the user approves)");
    }
    const flag = rows(execute(target, "SELECT value FROM runtime_flags WHERE key = 'sync.enabled';"), 0)[0]?.value;
    if (flag === "on") usage("sync.enabled is on: set it off first, then hand over the watermark");
    const start = l0 - 1;
    execute(
      target,
      `INSERT INTO sync_state (name, low_watermark, high_seen, applied_above) VALUES ('supabase_in', ${start}, ${start}, '[]') ` +
        `ON CONFLICT (name) DO UPDATE SET low_watermark = excluded.low_watermark, high_seen = excluded.high_seen, ` +
        `applied_above = '[]', last_error = '';`,
    );
    const readBack = rows(execute(target, "SELECT low_watermark, high_seen, applied_above FROM sync_state WHERE name = 'supabase_in';"), 0)[0];
    if (Number(readBack?.low_watermark) !== start || Number(readBack?.high_seen) !== start) {
      console.error(`read-back mismatch in ${where}:`, readBack);
      process.exit(1);
    }
    console.log(`sync_state supabase_in: low_watermark = high_seen = ${start} in ${where}. Next: pnpm flags set sync.enabled on ...`);
    return;
  }

  usage();
}

main();

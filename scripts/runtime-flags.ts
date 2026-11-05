/**
 * Reads and changes the Worker's runtime flags in D1 (`runtime_flags`), logging
 * every change in `runtime_flag_events`. The only supported way to flip a
 * screen between the legacy and api paths (docs/supabase-exit/STEP1_DESIGN.md 3.1).
 *
 * Usage:
 *   tsx scripts/runtime-flags.ts list --env testbed|production [--remote]
 *   tsx scripts/runtime-flags.ts set path.<group> legacy|api --env testbed|production --note "why" [--remote]
 *
 * Without --remote it touches the local `wrangler dev` database. Changing
 * production also needs --confirm-production, and only after the user approves.
 */
import { spawnSync } from "node:child_process";

import { API_SURFACE_GROUPS, SURFACE_PATHS, pathFlagKey } from "../src/lib/api-surfaces";

type Target = { env: "testbed" | "production"; remote: boolean };

const KNOWN_KEYS = new Map<string, readonly string[]>(
  API_SURFACE_GROUPS.map((group) => [pathFlagKey(group), SURFACE_PATHS]),
);

function usage(message?: string): never {
  if (message) console.error(message);
  console.error([
    "Usage:",
    "  tsx scripts/runtime-flags.ts list --env testbed|production [--remote]",
    "  tsx scripts/runtime-flags.ts set path.<group> legacy|api --env testbed|production --note \"why\" [--remote] [--confirm-production]",
    `Keys: ${[...KNOWN_KEYS.keys()].join(", ")}`,
  ].join("\n"));
  process.exit(2);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function execute(target: Target, sql: string): unknown {
  const args = ["exec", "wrangler", "d1", "execute", "DB", target.remote ? "--remote" : "--local", "--json", "--command", sql];
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

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const env = option(rest, "--env");
  if (env !== "testbed" && env !== "production") usage("--env testbed or --env production is required");
  const target: Target = { env, remote: rest.includes("--remote") };
  const where = `${env}${target.remote ? " (remote)" : " (local)"}`;

  if (command === "list") {
    const output = execute(
      target,
      "SELECT key, value, updated_at, note FROM runtime_flags ORDER BY key; " +
        "SELECT key, value, at, note FROM runtime_flag_events ORDER BY id DESC LIMIT 10;",
    );
    console.log(`runtime_flags in ${where}:`);
    console.table(rows(output, 0));
    console.log("last changes:");
    console.table(rows(output, 1));
    return;
  }

  if (command === "set") {
    const [key, value] = rest;
    const allowed = key ? KNOWN_KEYS.get(key) : undefined;
    if (!allowed) usage(`unknown key: ${key}`);
    if (!value || !allowed.includes(value)) usage(`value for ${key} must be one of ${allowed.join(", ")}`);
    const note = (option(rest, "--note") ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
    if (!note) usage("--note is required");
    if (env === "production" && target.remote && !rest.includes("--confirm-production")) {
      usage("changing production needs --confirm-production (after the user approves)");
    }
    const at = new Date().toISOString();
    execute(
      target,
      `INSERT INTO runtime_flags (key, value, updated_at, note) VALUES (${sqlString(key)}, ${sqlString(value)}, ${sqlString(at)}, ${sqlString(note)}) ` +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, note = excluded.note; " +
        `INSERT INTO runtime_flag_events (key, value, at, note) VALUES (${sqlString(key)}, ${sqlString(value)}, ${sqlString(at)}, ${sqlString(note)});`,
    );
    console.log(`${key} = ${value} in ${where} at ${at}. Workers pick it up within about 30 s.`);
    return;
  }

  usage();
}

main();

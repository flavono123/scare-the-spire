/**
 * Reads and changes the Worker's runtime flags in D1 (`runtime_flags`), logging
 * every change in `runtime_flag_events`. The only supported way to flip a
 * screen between the legacy and api paths (docs/supabase-exit/STEP1_DESIGN.md 3.1).
 *
 * Usage:
 *   tsx scripts/runtime-flags.ts list --env testbed|production --remote|--local
 *   tsx scripts/runtime-flags.ts set path.<group> legacy|api --env testbed|production --remote|--local --note "why"
 *   tsx scripts/runtime-flags.ts set shadow.<group> 0..1 --env testbed|production --remote|--local --note "why"
 *
 * shadow.<group> is the step 2 shadow-read sample rate (docs/supabase-exit/D1_SCHEMA_DESIGN.md 6):
 * 0 (or no row) compares nothing, 1 compares every api read of the group.
 *   tsx scripts/runtime-flags.ts set read.<group> supabase|d1 --env ... --note "why"       (step 3 read store)
 * read.<group> = d1 answers the group's GET routes from D1 (no row = supabase); while source.<group> is
 * supabase a D1 failure falls back to Supabase for that request.
 *   tsx scripts/runtime-flags.ts set identity.mode token|cookie --env testbed|production --remote|--local --note "why"
 *   tsx scripts/runtime-flags.ts set source.<group> supabase|d1 --env ... --note "why"   (step 5 write source)
 *   tsx scripts/runtime-flags.ts set write.paused on|off --env ... --note "why"           (step 5 cutover pause)
 *
 * The step 5 keys are normally flipped together by scripts/d1-cutover.ts (pause, drain, reconcile,
 * every source.<group>, unpause); setting them one by one is for a rollback by hand.
 *
 * The target must be named: wrangler 4's `d1 execute` defaults to the local
 * file, so a rollback that forgot --remote would "succeed" without touching
 * Cloudflare. Changing production also needs --confirm-production, and only
 * after the user approves. Workers pick a change up within about 30 s.
 */
import { spawnSync } from "node:child_process";

import { checkFlagSet, KNOWN_KEYS } from "./runtime-flag-keys";

type Target = { env: "testbed" | "production"; remote: boolean };

const DATABASES = { testbed: "slseoun-testbed", production: "slseoun-prod" } as const;

function usage(message?: string): never {
  if (message) console.error(message);
  console.error([
    "Usage:",
    "  tsx scripts/runtime-flags.ts list --env testbed|production --remote|--local",
    "  tsx scripts/runtime-flags.ts set path.<group> legacy|api --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
    "  tsx scripts/runtime-flags.ts set sync.enabled on|off --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
    "  tsx scripts/runtime-flags.ts set shadow.<group> 0..1 --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
    "  tsx scripts/runtime-flags.ts set read.<group> supabase|d1 --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
    "  tsx scripts/runtime-flags.ts set identity.mode token|cookie --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
    "  tsx scripts/runtime-flags.ts set write.<group> rls|worker --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
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

function main() {
  const argv = process.argv.slice(2);
  // `pnpm flags -- set …` passes the separator through.
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
    const checked = checkFlagSet(key, value, { env, remote, confirmProduction: rest.includes("--confirm-production") });
    if (!checked.ok) usage(checked.message);
    const note = (option(rest, "--note") ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
    if (!note) usage("--note is required");
    const at = new Date().toISOString();
    execute(
      target,
      `INSERT INTO runtime_flags (key, value, updated_at, note) VALUES (${sqlString(key)}, ${sqlString(value)}, ${sqlString(at)}, ${sqlString(note)}) ` +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, note = excluded.note; " +
        `INSERT INTO runtime_flag_events (key, value, at, note) VALUES (${sqlString(key)}, ${sqlString(value)}, ${sqlString(at)}, ${sqlString(note)});`,
    );
    const readBack = rows(execute(target, `SELECT key, value, updated_at, note FROM runtime_flags WHERE key = ${sqlString(key)};`), 0)[0];
    if (readBack?.value !== value || readBack?.updated_at !== at) {
      console.error(`read-back mismatch in ${where}:`, readBack);
      process.exit(1);
    }
    console.log(`${key} = ${value} in ${where} at ${at}. Workers pick it up within about 30 s.`);
    return;
  }

  usage();
}

main();

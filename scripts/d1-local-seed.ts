/**
 * Seeds the local D1 that `wrangler dev --local` uses and writes the local main Worker's env file,
 * so `pnpm dev` shows community data again after step 6 (docs/supabase-exit/STEP6_PLAN.md WP-Q).
 * Local development reads its own SQLite and never production data (docs/SUPABASE_EXIT_PLAN.md 5.6).
 *
 *   pnpm exec tsx scripts/d1-local-seed.ts                      # copy the testbed D1
 *   pnpm exec tsx scripts/d1-local-seed.ts --from-file <dump>   # import a `wrangler d1 export` file
 *   pnpm exec tsx scripts/d1-local-seed.ts --keep-export        # keep the testbed export file
 *
 * 1. Exports the testbed D1 (`wrangler d1 export DB --env testbed --remote`, a read; D1 holds other
 *    queries while an export runs, so not during a testbed QA run). The export holds testbed users'
 *    rows (reply e-mails among them): it is written under .wrangler/ and deleted after the import.
 * 2. Replaces the local D1 (default env, .wrangler/state) with it: drops every table, imports.
 * 3. Applies the d1/migrations the export does not have yet.
 * 4. Sets the local runtime flags to the production step 5 state (STEP6_PLAN.md 2, P3 to P8).
 * 5. Empties the local outbox: nothing written here or copied from the testbed is ever sent on.
 * 6. Writes LOCAL_API_ENV_FILE for the local main Worker (scripts/dev-patch-proxy.mjs,
 *    `pnpm cf:testbed:local --api`): the Supabase URL and publishable key from .env.local (as
 *    `cf:testbed:local --api` reads them), API_DATA_ENV development, a local API_IDENTITY_SECRET
 *    (kept across runs, so a claimed browser keeps its cookie), and no Supabase secret key, so the
 *    outbox mirror and the step 2 sync stay off and local writes stay in the local D1. Claims still
 *    sign new browsers up on the shared Supabase's Auth, as the anonymous sign-in did before step 6.
 *
 * Every wrangler call but the export names --local. No value from .env.local is printed.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { API_SURFACE_GROUPS, pathFlagKey, readFlagKey } from "../src/lib/api-surfaces";
import { WRITE_FLAG_GROUPS, writeFlagKey } from "../src/lib/api-write-modes";
import { IDENTITY_MODE_KEY } from "../src/lib/identity-cookies";
import { WRITE_GROUPS, WRITE_PAUSED_KEY, sourceFlagKey } from "../src/lib/write-source-flags";
import { supabaseApiConfig } from "../workers/api/supabase-rest";
import { SYNC_FLAG_KEY } from "../workers/sync/sync-env";
import { checkFlagSet } from "./runtime-flag-keys";

/** Read by scripts/dev-patch-proxy.mjs and scripts/run-cloudflare-testbed.mjs (keep the paths equal). */
const LOCAL_API_DIR = ".wrangler/local-api";
const LOCAL_API_ENV_FILE = `${LOCAL_API_DIR}/worker.env`;
const EXPORT_FILE = `${LOCAL_API_DIR}/testbed-export.sql`;
/** The data env of every local stack: the testbed's rows, never production's (plan 5.6). */
const LOCAL_DATA_ENV = "development";
const FLAG_NOTE = "d1-local-seed: production step 5 state";

/** Production's runtime flags since step 5 (STEP6_PLAN.md 2: P3 path, P4 identity, P5 write, P6 source, P7 read, P8). */
const LOCAL_RUNTIME_FLAGS: ReadonlyArray<readonly [string, string]> = [
  ...API_SURFACE_GROUPS.map((group) => [pathFlagKey(group), "api"] as const),
  [IDENTITY_MODE_KEY, "cookie"],
  ...WRITE_FLAG_GROUPS.map((group) => [writeFlagKey(group), "worker"] as const),
  ...WRITE_GROUPS.map((group) => [sourceFlagKey(group), "d1"] as const),
  [readFlagKey("nav"), "d1"],
  [readFlagKey("colorful-philosophers"), "d1"],
  [SYNC_FLAG_KEY, "off"],
  [WRITE_PAUSED_KEY, "off"],
];

type Options = { fromFile: string | null; keepExport: boolean };

function usage(message?: string): never {
  if (message) console.error(message);
  console.error("Usage: pnpm exec tsx scripts/d1-local-seed.ts [--from-file <wrangler d1 export file>] [--keep-export]");
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const options: Options = { fromFile: null, keepExport: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--help") usage();
    if (argument === "--from-file") {
      const file = argv[++index];
      if (!file) usage("--from-file needs a path");
      options.fromFile = resolve(file);
      continue;
    }
    if (argument === "--keep-export") {
      options.keepExport = true;
      continue;
    }
    usage(`unknown option: ${argument}`);
  }
  if (options.fromFile && !existsSync(options.fromFile)) usage(`no such file: ${options.fromFile}`);
  return options;
}

/** One key from the environment, .env.local or .env, without loading the rest (it holds service secrets). */
function checkoutEnvValue(name: string): string {
  if (process.env[name]) return process.env[name] ?? "";
  for (const file of [".env.local", ".env"]) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const line = text.split("\n").find((candidate) => candidate.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function wrangler(label: string, args: string[], { capture = false } = {}): string {
  console.log(`\n[d1-local-seed] ${label}`);
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    env: { ...process.env, WRANGLER_WRITE_LOGS: "0" },
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture && result.stdout) console.error(result.stdout);
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
  return result.stdout ?? "";
}

/** Rows of a single local SELECT. */
function localRows(label: string, sql: string): Record<string, unknown>[] {
  const output = wrangler(label, ["d1", "execute", "DB", "--local", "--yes", "--json", "--command", sql], { capture: true });
  const parsed = JSON.parse(output) as { results?: Record<string, unknown>[] }[];
  return parsed[0]?.results ?? [];
}

function localFile(label: string, file: string): void {
  // Captured: a local --file run prints every statement's result.
  wrangler(label, ["d1", "execute", "DB", "--local", "--yes", "--file", file], { capture: true });
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** The statements that empty the local D1: every table and view but SQLite's and D1's own. */
function dropStatements(objects: { type: string; name: string }[]): string {
  const lines = ["PRAGMA defer_foreign_keys = true;"];
  for (const object of objects) {
    if (object.name.startsWith("sqlite_") || object.name.startsWith("_cf_")) continue;
    if (object.type === "view") lines.push(`DROP VIEW IF EXISTS ${sqlIdentifier(object.name)};`);
    else if (object.type === "table") lines.push(`DROP TABLE IF EXISTS ${sqlIdentifier(object.name)};`);
  }
  return `${lines.join("\n")}\n`;
}

/** Upserts LOCAL_RUNTIME_FLAGS and logs each in runtime_flag_events, as scripts/runtime-flags.ts does. */
function flagStatements(at: string): string {
  const lines: string[] = [];
  for (const [key, value] of LOCAL_RUNTIME_FLAGS) {
    const checked = checkFlagSet(key, value, { env: "production", remote: false, confirmProduction: false });
    if (!checked.ok) throw new Error(checked.message);
    const values = `${sqlString(key)}, ${sqlString(value)}, ${sqlString(at)}, ${sqlString(FLAG_NOTE)}`;
    lines.push(
      `INSERT INTO runtime_flags (key, value, updated_at, note) VALUES (${values}) `
        + "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, note = excluded.note;",
      `INSERT INTO runtime_flag_events (key, value, at, note) VALUES (${values});`,
    );
  }
  // The mirror's queue: rows the testbed had not sent yet, and anything written here later, stay here.
  lines.push("DELETE FROM outbox;", "DELETE FROM sync_rejects WHERE direction = 'out';");
  return `${lines.join("\n")}\n`;
}

/** The identity secret of an earlier seed, so claimed browsers keep their cookie. */
function previousIdentitySecret(): string | null {
  try {
    const line = readFileSync(LOCAL_API_ENV_FILE, "utf8").split("\n").find((candidate) => candidate.startsWith("API_IDENTITY_SECRET="));
    const value = line?.slice("API_IDENTITY_SECRET=".length).trim() ?? "";
    return value.length >= 32 ? value : null;
  } catch {
    return null;
  }
}

function workerEnvText(vars: { url: string; key: string; identitySecret: string }): string {
  return [
    "# Written by scripts/d1-local-seed.ts for the local main Worker (wrangler dev --local --env-file).",
    "# Local only: .wrangler/ is not committed. Re-run the seed to refresh it.",
    "API_RUNTIME_FLAGS=d1",
    `API_SUPABASE_URL=${vars.url}`,
    `API_SUPABASE_KEY=${vars.key}`,
    `API_DATA_ENV=${LOCAL_DATA_ENV}`,
    `API_IDENTITY_SECRET=${vars.identitySecret}`,
    "# No Supabase secret key: the outbox mirror and the step 2 sync stay off.",
    "API_SUPABASE_SECRET_KEY=",
    "API_SUPABASE_SERVICE_KEY=",
    "",
  ].join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const config = supabaseApiConfig({
    API_SUPABASE_URL: checkoutEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
    API_SUPABASE_KEY: checkoutEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    API_DATA_ENV: LOCAL_DATA_ENV,
  });
  if (!config) {
    usage(
      "NEXT_PUBLIC_SUPABASE_URL must be https://<20-char ref>.supabase.co (or a local stub) and "
        + "NEXT_PUBLIC_SUPABASE_ANON_KEY a sb_publishable_ key, in .env.local or the environment.",
    );
  }
  const pageEnv = checkoutEnvValue("NEXT_PUBLIC_SUPABASE_ENV") || "production";
  if (pageEnv !== LOCAL_DATA_ENV) {
    console.warn(
      `[d1-local-seed] NEXT_PUBLIC_SUPABASE_ENV is ${pageEnv}: local pages then expect ${pageEnv} answers, `
        + `but the local Worker answers for ${LOCAL_DATA_ENV} (nav dots and writes check the env). Set it to ${LOCAL_DATA_ENV}.`,
    );
  }

  mkdirSync(LOCAL_API_DIR, { recursive: true });
  let dump = options.fromFile;
  if (!dump) {
    rmSync(EXPORT_FILE, { force: true });
    wrangler("export the testbed D1 (read only)", ["d1", "export", "DB", "--env", "testbed", "--remote", "--output", EXPORT_FILE]);
    dump = resolve(EXPORT_FILE);
  }

  try {
    const objects = localRows(
      "list the local D1's tables",
      "SELECT type, name FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY rowid DESC",
    ).map((row) => ({ type: String(row.type), name: String(row.name) }));
    const dropFile = `${LOCAL_API_DIR}/drop.sql`;
    writeFileSync(dropFile, dropStatements(objects));
    localFile("empty the local D1", dropFile);
    rmSync(dropFile, { force: true });

    localFile("import the export into the local D1", dump);
  } finally {
    if (!options.fromFile && !options.keepExport) rmSync(EXPORT_FILE, { force: true });
  }

  wrangler("apply d1/migrations to the local D1", ["d1", "migrations", "apply", "DB", "--local"]);

  const flagFile = `${LOCAL_API_DIR}/flags.sql`;
  writeFileSync(flagFile, flagStatements(new Date().toISOString()));
  localFile("set the local runtime flags and empty the local outbox", flagFile);
  rmSync(flagFile, { force: true });

  const identitySecret = previousIdentitySecret() ?? randomBytes(32).toString("base64url");
  mkdirSync(dirname(LOCAL_API_ENV_FILE), { recursive: true });
  writeFileSync(LOCAL_API_ENV_FILE, workerEnvText({ url: config.url, key: config.key, identitySecret }), { mode: 0o600 });
  chmodSync(LOCAL_API_ENV_FILE, 0o600);

  const counts = localRows(
    "count the local rows",
    "SELECT (SELECT count(*) FROM posts) AS posts, (SELECT count(*) FROM comments) AS comments, "
      + "(SELECT count(*) FROM runtime_flags) AS flags",
  )[0] ?? {};
  console.log(
    `\n[d1-local-seed] local D1 ready: ${counts.posts ?? 0} posts, ${counts.comments ?? 0} comments, `
      + `${counts.flags ?? 0} runtime flags (Supabase ${new URL(config.url).host}, env ${LOCAL_DATA_ENV}).`,
  );
  console.log(`[d1-local-seed] wrote ${LOCAL_API_ENV_FILE}; \`pnpm dev\` starts the local Worker with it.`);
}

try {
  main();
} catch (error) {
  console.error(`\n[d1-local-seed] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}

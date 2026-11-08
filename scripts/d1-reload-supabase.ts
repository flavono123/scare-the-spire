/**
 * The full D1 -> Supabase reload, the manual rollback once the step 5 mirror is off
 * (docs/SUPABASE_EXIT_PLAN.md 7.3 step 7, 7.4; the steps are in scripts/d1-sync/reload-supabase.ts).
 * Run it once on testbed before step 5 (plan 7.3).
 *
 *   pnpm exec tsx --env-file=.env.local scripts/d1-reload-supabase.ts --env testbed --dry-run
 *   pnpm exec tsx scripts/runtime-flags.ts set write.paused on --env testbed --remote --note "reload"
 *   pnpm exec tsx --env-file=.env.local scripts/d1-reload-supabase.ts --env testbed [--tables comments,likes]
 *   ... --env production --confirm-production   (only after the user approves; a dry run needs no approval)
 *
 * Then check with pnpm d1:reconcile, set every source.<group> to supabase and write.paused off.
 *
 * Environment (values are never printed):
 *   SUPABASE_URL               the Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  the service role (secret) key: Supabase writes
 *   CLOUDFLARE_ACCOUNT_ID      the Cloudflare account
 *   CLOUDFLARE_D1_API_TOKEN    an API token with D1 read on that account (the reload never writes D1)
 *
 * Exit 0: done or a clean dry run. 1: refused or stopped (the report says where). 2: bad arguments.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_ENVS } from "./d1-sync/cutover";
import { d1HttpClient, type FetchLike } from "./d1-sync/d1-http-client";
import { postgrestReader } from "./d1-sync/postgrest-reader";
import { d1DatabaseId, isTargetName } from "./d1-sync/reconcile";
import { RELOAD_ORDER, runReload } from "./d1-sync/reload-supabase";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_API_TOKEN"] as const;
const FLAGS = new Set(["--dry-run", "--confirm-production"]);
const VALUED = new Set(["--env", "--tables"]);

function usage(message: string): never {
  console.error(message);
  console.error("Usage: tsx scripts/d1-reload-supabase.ts --env testbed|production [--dry-run] [--tables a,b] [--confirm-production]");
  process.exit(2);
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  for (let i = 0; i < argv.length; i++) {
    if (VALUED.has(argv[i])) i += 1;
    else if (!FLAGS.has(argv[i])) usage(`unknown argument ${argv[i]}`);
  }
  const target = option(argv, "--env");
  if (!isTargetName(target)) usage("--env testbed or --env production is required");
  const dryRun = argv.includes("--dry-run");
  if (target === "production" && !dryRun && !argv.includes("--confirm-production")) {
    usage("writing production Supabase needs --confirm-production (after the user approves)");
  }
  const tables = option(argv, "--tables")?.split(",").filter(Boolean);
  const unknown = tables?.filter((table) => !RELOAD_ORDER.includes(table)) ?? [];
  if (unknown.length) usage(`unknown table ${unknown[0]}; tables: ${RELOAD_ORDER.join(", ")}`);
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) usage(`missing environment: ${missing.join(", ")}`);

  const fetchLike = fetch as unknown as FetchLike;
  const url = process.env.SUPABASE_URL!.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const report = await runReload(
    {
      d1: d1HttpClient({
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        databaseId: d1DatabaseId(target, readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")),
        token: process.env.CLOUDFLARE_D1_API_TOKEN!,
        fetch: fetchLike,
      }),
      supabase: postgrestReader({ url, serviceKey: key, fetch: fetchLike }),
      config: { url, key, dataEnv: DATA_ENVS[target] },
      fetcher: (input, init) => fetch(input, init),
      log: (line) => console.log(line),
    },
    { target, dryRun, tables },
  );
  process.exit(report.status === "done" || report.status === "dry_run" ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(`d1 reload error: ${(error as Error).message}`);
  process.exit(1);
});

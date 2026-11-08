/**
 * The step 5 cutover of the Supabase exit: make D1 the write source, or go back to Supabase
 * (docs/SUPABASE_EXIT_PLAN.md 7.3 step 5; the steps are in scripts/d1-sync/cutover.ts).
 *
 *   pnpm exec tsx --env-file=.env.local scripts/d1-cutover.ts --to d1 --env testbed --note "why" [--dry-run]
 *   pnpm exec tsx --env-file=.env.local scripts/d1-cutover.ts --to supabase --env testbed --note "why" [--dry-run] [--no-refill]
 *   ... --env production --confirm-production   (only after the user approves; a dry run needs no approval)
 *
 * Try both directions on testbed a few times before production (plan 7.3). Writes pause for the
 * gate's cache time (about 35 s) plus the drain and the reconcile; the browser resends a paused write
 * for up to 90 s.
 *
 * Environment (values are never printed):
 *   SUPABASE_URL               the Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  the service role (secret) key: change log reads and the reconcile
 *   CLOUDFLARE_ACCOUNT_ID      the Cloudflare account
 *   CLOUDFLARE_D1_API_TOKEN    an API token with D1 edit on that account (flags, sync state, reconcile)
 * The reverse's re-fill runs scripts/d1-first-copy.ts --refill, which reads its own variables
 * (SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD, CLOUDFLARE_API_TOKEN; see that file).
 *
 * Exit 0: done or a clean dry run. 1: refused, undone or failed (the report says which). 2: bad arguments.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCutover, changeLogReader, type CutoverDirection } from "./d1-sync/cutover";
import { d1HttpClient, type FetchLike } from "./d1-sync/d1-http-client";
import { postgrestReader } from "./d1-sync/postgrest-reader";
import { d1DatabaseId, isTargetName, runReconcile } from "./d1-sync/reconcile";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_API_TOKEN"] as const;
const FLAGS = new Set(["--dry-run", "--confirm-production", "--no-refill"]);
const VALUED = new Set(["--to", "--env", "--note"]);

function usage(message: string): never {
  console.error(message);
  console.error("Usage: tsx scripts/d1-cutover.ts --to d1|supabase --env testbed|production --note \"why\" [--dry-run] [--no-refill] [--confirm-production]");
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
  const to = option(argv, "--to");
  if (to !== "d1" && to !== "supabase") usage("--to d1 or --to supabase is required");
  const target = option(argv, "--env");
  if (!isTargetName(target)) usage("--env testbed or --env production is required");
  const note = (option(argv, "--note") ?? "").replace(/[\u0000-\u001f]/g, " ").trim();
  if (!note) usage("--note is required");
  const dryRun = argv.includes("--dry-run");
  if (target === "production" && !dryRun && !argv.includes("--confirm-production")) {
    usage("changing production needs --confirm-production (after the user approves)");
  }
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) usage(`missing environment: ${missing.join(", ")}`);

  const fetchLike = fetch as unknown as FetchLike;
  const d1 = d1HttpClient({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: d1DatabaseId(target, readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")),
    token: process.env.CLOUDFLARE_D1_API_TOKEN!,
    fetch: fetchLike,
  });
  const supabase = { url: process.env.SUPABASE_URL!, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!, fetch: fetchLike };

  const report = await runCutover(
    {
      d1,
      changeLog: changeLogReader(supabase),
      async reconcile() {
        const result = await runReconcile({ target, d1, supabase: postgrestReader(supabase) });
        return { ok: result.status === "ok", lines: result.lines };
      },
      async refill() {
        const args = ["exec", "tsx", "scripts/d1-first-copy.ts", "--env", target, "--refill"];
        if (target === "production") args.push("--confirm-production");
        const child = spawnSync("pnpm", args, { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
        const lines = `${child.stdout ?? ""}${child.stderr ?? ""}`.split("\n").filter(Boolean);
        return { ok: child.status === 0, lines: [...lines, `first copy --refill exit ${child.status}`] };
      },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
      log: (line) => console.log(line),
    },
    { target, to: to as CutoverDirection, note, dryRun, skipRefill: argv.includes("--no-refill") },
  );
  process.exit(report.status === "done" || report.status === "dry_run" ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(`d1 cutover error: ${(error as Error).message}`);
  process.exit(1);
});

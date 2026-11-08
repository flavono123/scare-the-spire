/**
 * The daily D1 reconcile and the run summary fill of the Supabase exit, step 2
 * (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.4, 4.4). GitHub Actions runs it every day
 * (.github/workflows/d1-reconcile.yml); it can also be run by hand.
 *
 *   pnpm d1:reconcile --target testbed|production              # fill, then compare
 *   pnpm d1:reconcile --target testbed|production --fill-only  # only the summary fill
 *
 * testbed: Supabase env 'development' against D1 slseoun-testbed; production: env 'production'
 * against D1 slseoun-prod (ids from wrangler.jsonc). Reads Supabase only (PostgREST, service key);
 * writes D1 only (RF2 and the day's sync_checks rows). Before the first copy exists (no step-2
 * schema, empty tables, or no sync watermark) it writes nothing and exits 0 with a notice.
 *
 * Environment (values are never printed):
 *   SUPABASE_URL               the Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  the service role key (read-only use here)
 *   CLOUDFLARE_ACCOUNT_ID      the Cloudflare account
 *   CLOUDFLARE_D1_API_TOKEN    an API token with D1 edit on that account
 *
 * Exit 0: ok, or skipped before the first copy. Exit 1: a failure the design counts (rows or derived
 * differences, run summary differences, open rejects) or an error. Exit 2: bad arguments or missing
 * environment.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { d1HttpClient, type FetchLike } from "./d1-sync/d1-http-client";
import { postgrestReader } from "./d1-sync/postgrest-reader";
import { d1DatabaseId, isTargetName, runReconcile, type ReconcileReport } from "./d1-sync/reconcile";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_API_TOKEN"] as const;

function usage(message: string): never {
  console.error(message);
  console.error("Usage: pnpm d1:reconcile --target testbed|production [--fill-only]");
  process.exit(2);
}

function annotate(report: ReconcileReport) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  const title = `D1 reconcile ${report.target}`;
  if (report.status === "skipped") console.log(`::notice title=${title}::${report.notice}`);
  for (const warning of report.warnings) console.log(`::warning title=${title}::${warning}`);
  if (report.status === "failed") console.log(`::error title=${title}::${report.failures.join("; ")}`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, [`### ${title}`, "", "```", ...report.lines, "```", ""].join("\n"));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  const targetIndex = argv.indexOf("--target");
  const target = targetIndex >= 0 ? argv[targetIndex + 1] : undefined;
  if (!isTargetName(target)) usage("--target testbed or --target production is required");
  const unknown = argv.filter((arg, i) => arg.startsWith("--") && arg !== "--target" && arg !== "--fill-only" && i !== targetIndex + 1);
  if (unknown.length > 0) usage(`unknown option ${unknown[0]}`);
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) usage(`missing environment: ${missing.join(", ")}`);

  const fetchLike = fetch as unknown as FetchLike;
  const d1 = d1HttpClient({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: d1DatabaseId(target, readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")),
    token: process.env.CLOUDFLARE_D1_API_TOKEN!,
    fetch: fetchLike,
  });
  const supabase = postgrestReader({
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    fetch: fetchLike,
  });
  const report = await runReconcile({ target, d1, supabase, fillOnly: argv.includes("--fill-only") });
  for (const line of report.lines) console.log(line);
  annotate(report);
  process.exit(report.status === "failed" ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(`d1 reconcile error: ${(error as Error).message}`);
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::error title=D1 reconcile::${(error as Error).message}`);
  process.exit(1);
});

/**
 * The D1 first copy and re-fill of Supabase exit step 2 (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.2).
 *
 *   # local D1 (wrangler's local state; --persist-to as for wrangler d1 execute --local)
 *   pnpm exec tsx scripts/d1-first-copy.ts --local [--persist-to <dir>] [--data-env development|production]
 *       [--dump-file <pg_dump file> [--no-change-log] | --pglite <data dir>] [--refill] [--dry-run]
 *   # remote D1 (Supabase through the session pooler; Cloudflare D1 HTTP API)
 *   pnpm exec tsx --env-file=.env.local scripts/d1-first-copy.ts --env testbed [--refill] [--dry-run]
 *   pnpm exec tsx --env-file=.env.local scripts/d1-first-copy.ts --env production --confirm-production [--refill]
 *
 * Other options: --work <dir> keeps the dump there (default: a private temp directory removed at the
 * end; the dump holds personal data), --write-budget <rows> (remote, default 80000), --report-json <file>.
 * Supabase: SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD (SUPABASE_POOLER_HOST optional), libpq psql and
 * pg_dump. Cloudflare: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or a wrangler login.
 * Exit codes: 0 done (or a clean dry run), 2 stopped by a check (nothing written unless the report
 * says the target is partly filled), 1 error.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LocalD1Target, RemoteD1Target, ROOT, wranglerDatabase, type D1Target } from "./d1-sync/first-copy-d1";
import type { DataEnv } from "./d1-sync/first-copy-plan";
import { DEFAULT_WRITE_BUDGET, formatReport, runFirstCopy } from "./d1-sync/first-copy-run";
import { DumpFileSource, PgliteSource, PoolerSource, poolerOptionsFromEnv, type CopySource } from "./d1-sync/first-copy-source";

interface Args {
  local: boolean;
  env: "testbed" | "production" | null;
  confirmProduction: boolean;
  dataEnv: DataEnv | null;
  persistTo: string;
  dumpFile: string | null;
  noChangeLog: boolean;
  pglite: string | null;
  refill: boolean;
  dryRun: boolean;
  work: string | null;
  writeBudget: number;
  reportJson: string | null;
}

const USAGE = "usage: tsx scripts/d1-first-copy.ts (--local | --env testbed | --env production --confirm-production) [options]; see the file header";

function parseArgs(argv: string[]): Args {
  const args: Args = {
    local: false,
    env: null,
    confirmProduction: false,
    dataEnv: null,
    persistTo: join(ROOT, ".wrangler/state"),
    dumpFile: null,
    noChangeLog: false,
    pglite: null,
    refill: false,
    dryRun: false,
    work: null,
    writeBudget: DEFAULT_WRITE_BUDGET,
    reportJson: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith("--")) throw new Error(`${flag} needs a value`);
      return next;
    };
    switch (flag) {
      case "--local": args.local = true; break;
      case "--env": {
        const env = value();
        if (env !== "testbed" && env !== "production") throw new Error("--env is testbed or production");
        args.env = env;
        break;
      }
      case "--confirm-production": args.confirmProduction = true; break;
      case "--data-env": {
        const env = value();
        if (env !== "development" && env !== "production") throw new Error("--data-env is development or production");
        args.dataEnv = env;
        break;
      }
      case "--persist-to": args.persistTo = resolve(value()); break;
      case "--dump-file": args.dumpFile = resolve(value()); break;
      case "--no-change-log": args.noChangeLog = true; break;
      case "--pglite": args.pglite = resolve(value()); break;
      case "--refill": args.refill = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--work": args.work = resolve(value()); break;
      case "--write-budget": {
        const n = Number(value());
        if (!Number.isSafeInteger(n) || n < 1) throw new Error("--write-budget is a positive row count");
        args.writeBudget = n;
        break;
      }
      case "--report-json": args.reportJson = resolve(value()); break;
      default: throw new Error(`unknown option ${flag}\n${USAGE}`);
    }
  }
  if (args.local === (args.env !== null)) throw new Error(`choose exactly one target: --local or --env\n${USAGE}`);
  if (args.env && (args.dumpFile || args.pglite)) throw new Error("a remote target copies from the live Supabase only (no --dump-file / --pglite)");
  if (args.env && args.dataEnv) throw new Error("--data-env is for --local; testbed holds development rows, production holds production rows");
  if (args.dumpFile && args.pglite) throw new Error("choose one source: --dump-file or --pglite");
  if (args.noChangeLog && !args.dumpFile) throw new Error("--no-change-log goes with --dump-file");
  if (args.env === "production" && !args.dryRun && !args.confirmProduction) {
    throw new Error("--env production writes the production D1: pass --confirm-production (only after the user approved it)");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env: DataEnv = args.env === "production" ? "production" : args.env === "testbed" ? "development" : (args.dataEnv ?? "development");
  const workDir = args.work ?? mkdtempSync(join(tmpdir(), "d1-first-copy-"));
  mkdirSync(workDir, { recursive: true, mode: 0o700 });
  const log = (line: string) => console.error(`[d1-first-copy] ${line}`);

  let target: D1Target | null = null;
  let source: CopySource | null = null;
  try {
    // The env's database: development rows live in slseoun-testbed, production rows in slseoun-prod.
    const database = wranglerDatabase(env === "production" ? "production" : "testbed");
    if (args.local) {
      target = await LocalD1Target.open({ database, persistTo: args.persistTo, workDir });
    } else {
      const { resolveAuthentication } = await import("./cloudflare-auth.mjs");
      const auth = resolveAuthentication() as { accountId: string; token: string };
      target = new RemoteD1Target(`remote D1 ${database.database_name} (${database.database_id})`, { ...auth, database });
    }
    source = args.dumpFile
      ? new DumpFileSource(args.dumpFile, { workDir, noChangeLog: args.noChangeLog })
      : args.pglite
        ? new PgliteSource(args.pglite)
        : new PoolerSource(poolerOptionsFromEnv(workDir));

    const report = await runFirstCopy({
      target,
      source,
      env,
      refill: args.refill,
      dryRun: args.dryRun,
      writeBudget: args.writeBudget,
      log,
    });
    console.log(formatReport(report));
    if (args.reportJson) writeFileSync(args.reportJson, `${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.outcome === "stopped" ? 2 : 0;
  } finally {
    await source?.close();
    await target?.close();
    if (!args.work) rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`d1-first-copy: ${(error as Error).message}`);
  process.exitCode = 1;
});

// Production Cloudflare usage against the Workers Free limits, for the dev admin
// "CF 한도" tab and `pnpm cf:limits`. Read-only: GitHub Actions deploy logs (gh CLI)
// for what the live versions uploaded, the Cloudflare API for live versions, D1
// sizes and today's analytics. docs/CLOUDFLARE_LIMITS.md explains every number.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { resolveAuthentication, WORKERS } from "../cloudflare-auth.mjs";

const execFileAsync = promisify(execFile);

/** Workers Free plan limits (https://developers.cloudflare.com/workers/platform/limits/, D1 /d1/platform/limits/). */
export const CLOUDFLARE_FREE_LIMITS = {
  staticAssetFilesPerVersion: 20_000,
  staticAssetBytesPerFile: 25 * 1024 * 1024,
  workerGzipKiB: 3072,
  requestsPerDay: 100_000,
  d1BytesPerDatabase: 500 * 1000 * 1000,
  d1BytesPerAccount: 5 * 1000 * 1000 * 1000,
  d1RowsReadPerDay: 5_000_000,
  d1RowsWrittenPerDay: 100_000,
} as const;

const DEPLOY_WORKFLOW = "cloudflare-workers.yml";
const MAX_RUNS_SCANNED = 15;

export interface DeployRun {
  id: number;
  url: string;
  sha: string;
  title: string;
  createdAt: string;
}

export interface WorkerDeployStats {
  worker: string;
  run: DeployRun;
  /** Files in the uploaded asset manifest (wrangler "Uploaded A files (B already uploaded)" = A + B). */
  assetFiles: number | null;
  versionId: string | null;
  liveVersionId: string | null;
  gzipKiB: number | null;
}

export interface StaticAssetCheck {
  used: number;
  budget: number;
  limit: number;
  largestMiB: number | null;
  largestPath: string | null;
  /** Files per first three directory segments; absent in deploys before this line was added. */
  groups: Record<string, number> | null;
}

export interface CloudflareLimitsReport {
  generatedAt: string;
  workers: { main: WorkerDeployStats | null; patch: WorkerDeployStats | null };
  staticAssets: StaticAssetCheck | null;
  d1: { name: string; id: string; bytes: number }[] | null;
  /** Since 00:00 UTC, when the Free daily allowances reset (09:00 KST). */
  today: {
    since: string;
    requestsByScript: Record<string, number>;
    d1ByDatabase: Record<string, { rowsRead: number; rowsWritten: number }>;
  } | null;
  errors: string[];
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const toNumber = (text: string) => Number(text.replaceAll(",", ""));

async function gh(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args, { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

interface ParsedRunLog {
  workers: Record<string, Omit<WorkerDeployStats, "run" | "liveVersionId" | "worker">>;
  staticAssets: StaticAssetCheck | null;
}

/** Pulls the deploy numbers out of one production workflow log. Exported for the self-check. */
export function parseDeployLog(log: string): ParsedRunLog {
  const workers: ParsedRunLog["workers"] = {};
  let current: string | null = null;
  let staticAssets: StaticAssetCheck | null = null;
  let mainGzipKiB: number | null = null;

  for (const line of log.split("\n")) {
    const read = line.match(/Read \d+ files? from the assets directory \S*?(\.cloudflare|\.patch-worker)\/assets/);
    if (read) {
      current = read[1] === ".cloudflare" ? WORKERS.main : WORKERS.patch;
      workers[current] ??= { assetFiles: null, versionId: null, gzipKiB: null };
      continue;
    }
    const upload = line.match(/Success! Uploaded (\d+) files?(?: \((\d+) already uploaded\))?/);
    if (upload && current) {
      workers[current].assetFiles = Number(upload[1]) + Number(upload[2] ?? 0);
      continue;
    }
    const total = line.match(/Total Upload: [\d.]+ KiB \/ gzip: ([\d.]+) KiB/);
    if (total && current) {
      workers[current].gzipKiB = Number(total[1]);
      continue;
    }
    const version = line.match(/Current Version ID: ([0-9a-f-]{36})/);
    if (version && current) {
      workers[current].versionId = version[1];
      continue;
    }
    const used = line.match(/Cloudflare static assets: ([\d,]+) used \/ ([\d,]+) budget \/ ([\d,]+) limit/);
    if (used) {
      staticAssets = {
        used: toNumber(used[1]),
        budget: toNumber(used[2]),
        limit: toNumber(used[3]),
        largestMiB: null,
        largestPath: null,
        groups: null,
      };
      continue;
    }
    const largest = line.match(/Largest Cloudflare static asset: ([\d.]+) MiB \((.+)\)/);
    if (largest && staticAssets) {
      staticAssets.largestMiB = Number(largest[1]);
      staticAssets.largestPath = largest[2].replace(/^\.cloudflare\/assets\//, "");
      continue;
    }
    const groups = line.match(/Cloudflare static asset groups: (\{.*\})/);
    if (groups && staticAssets) {
      staticAssets.groups = JSON.parse(groups[1]);
      continue;
    }
    const size = line.match(/Cloudflare Worker upload size: [\d.]+ KiB \/ gzip ([\d.]+) KiB/);
    if (size) mainGzipKiB = Number(size[1]);
  }

  if (mainGzipKiB !== null && workers[WORKERS.main]) workers[WORKERS.main].gzipKiB = mainGzipKiB;
  // A run that built main but did not deploy it (failed step) has no version.
  for (const [name, stats] of Object.entries(workers)) {
    if (!stats.versionId) delete workers[name];
  }
  return { workers, staticAssets: workers[WORKERS.main] ? staticAssets : null };
}

/** Newest successful production runs, newest first, until both Workers were found. */
async function readDeployStats(): Promise<{
  main: Omit<WorkerDeployStats, "liveVersionId"> | null;
  patch: Omit<WorkerDeployStats, "liveVersionId"> | null;
  staticAssets: StaticAssetCheck | null;
}> {
  const runs = JSON.parse(await gh([
    "run", "list", "--workflow", DEPLOY_WORKFLOW, "--branch", "main", "--status", "success",
    "--limit", String(MAX_RUNS_SCANNED), "--json", "databaseId,url,headSha,displayTitle,createdAt",
  ])) as { databaseId: number; url: string; headSha: string; displayTitle: string; createdAt: string }[];

  let main: Omit<WorkerDeployStats, "liveVersionId"> | null = null;
  let patch: Omit<WorkerDeployStats, "liveVersionId"> | null = null;
  let staticAssets: StaticAssetCheck | null = null;
  for (const row of runs) {
    const run: DeployRun = {
      id: row.databaseId, url: row.url, sha: row.headSha, title: row.displayTitle, createdAt: row.createdAt,
    };
    const parsed = parseDeployLog(await gh(["run", "view", String(run.id), "--log"]));
    const mainStats = parsed.workers[WORKERS.main];
    const patchStats = parsed.workers[WORKERS.patch];
    if (!main && mainStats) {
      main = { worker: WORKERS.main, run, ...mainStats };
      staticAssets = parsed.staticAssets;
    }
    if (!patch && patchStats) patch = { worker: WORKERS.patch, run, ...patchStats };
    if (main && patch) break;
  }
  return { main, patch, staticAssets };
}

async function cloudflareApi<T>(auth: { accountId: string; token: string }, pathname: string): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${auth.accountId}${pathname}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const body = await response.json() as { success: boolean; result: T; errors?: { message: string }[] };
  if (!response.ok || !body.success) {
    throw new Error(`Cloudflare API ${pathname}: ${body.errors?.map((e) => e.message).join("; ") || response.status}`);
  }
  return body.result;
}

async function liveVersionId(auth: { accountId: string; token: string }, worker: string): Promise<string | null> {
  const result = await cloudflareApi<{ deployments: { versions: { version_id: string; percentage: number }[] }[] }>(
    auth, `/workers/scripts/${worker}/deployments`,
  );
  const versions = result.deployments[0]?.versions ?? [];
  return versions.sort((a, b) => b.percentage - a.percentage)[0]?.version_id ?? null;
}

async function readToday(auth: { accountId: string; token: string }) {
  const since = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  const query = `query ($account: String!, $since: Time!, $date: Date!) {
    viewer { accounts(filter: { accountTag: $account }) {
      workers: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $since }) {
        sum { requests } dimensions { scriptName }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: $date }) {
        sum { rowsRead rowsWritten } dimensions { databaseId }
      }
    } }
  }`;
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { account: auth.accountId, since, date: since.slice(0, 10) } }),
  });
  const body = await response.json() as {
    data?: { viewer: { accounts: {
      workers: { sum: { requests: number }; dimensions: { scriptName: string } }[];
      d1: { sum: { rowsRead: number; rowsWritten: number }; dimensions: { databaseId: string } }[];
    }[] } };
    errors?: { message: string }[] | null;
  };
  if (body.errors?.length) throw new Error(`Cloudflare GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  const account = body.data?.viewer.accounts[0];
  const requestsByScript: Record<string, number> = {};
  for (const row of account?.workers ?? []) {
    requestsByScript[row.dimensions.scriptName] = (requestsByScript[row.dimensions.scriptName] ?? 0) + row.sum.requests;
  }
  const d1ByDatabase: Record<string, { rowsRead: number; rowsWritten: number }> = {};
  for (const row of account?.d1 ?? []) {
    const entry = (d1ByDatabase[row.dimensions.databaseId] ??= { rowsRead: 0, rowsWritten: 0 });
    entry.rowsRead += row.sum.rowsRead;
    entry.rowsWritten += row.sum.rowsWritten;
  }
  return { since, requestsByScript, d1ByDatabase };
}

export async function readCloudflareLimits(): Promise<CloudflareLimitsReport> {
  const errors: string[] = [];
  const settle = async <T>(label: string, task: () => Promise<T>): Promise<T | null> => {
    try {
      return await task();
    } catch (error) {
      errors.push(`${label}: ${errorText(error)}`);
      return null;
    }
  };

  let auth: { accountId: string; token: string } | null = null;
  try {
    auth = resolveAuthentication();
  } catch (error) {
    errors.push(`Cloudflare 인증: ${errorText(error)}`);
  }

  const [deploys, liveMain, livePatch, d1, today] = await Promise.all([
    settle("GitHub Actions 배포 로그 (gh)", readDeployStats),
    auth ? settle("main 운영 버전", () => liveVersionId(auth, WORKERS.main)) : null,
    auth ? settle("patch 운영 버전", () => liveVersionId(auth, WORKERS.patch)) : null,
    auth
      ? settle("D1 목록", async () =>
        (await cloudflareApi<{ name: string; uuid: string; file_size: number }[]>(auth, "/d1/database"))
          .map((db) => ({ name: db.name, id: db.uuid, bytes: db.file_size })))
      : null,
    auth ? settle("오늘 사용량 (GraphQL)", () => readToday(auth)) : null,
  ]);

  return {
    generatedAt: new Date().toISOString(),
    workers: {
      main: deploys?.main ? { ...deploys.main, liveVersionId: liveMain } : null,
      patch: deploys?.patch ? { ...deploys.patch, liveVersionId: livePatch } : null,
    },
    staticAssets: deploys?.staticAssets ?? null,
    d1,
    today,
    errors,
  };
}

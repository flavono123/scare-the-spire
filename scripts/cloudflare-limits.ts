// `pnpm cf:limits [-- --json]`: production Cloudflare usage against the Workers Free
// limits. Same data as the dev admin "CF 한도" tab; see docs/CLOUDFLARE_LIMITS.md.
import { CLOUDFLARE_FREE_LIMITS as L, readCloudflareLimits } from "./lib/cloudflare-limits";

async function main() {
  const report = await readCloudflareLimits();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.errors.length ? 1 : 0);
  }

  const n = (value: number) => value.toLocaleString("en-US");
  const pct = (used: number, limit: number) => `${((used / limit) * 100).toFixed(1)}%`;
  const line = (label: string, used: number, limit: number, unit = "") =>
    console.log(`${label.padEnd(30)} ${n(used)}${unit} / ${n(limit)}${unit} (${pct(used, limit)}, ${n(limit - used)}${unit} left)`);

  for (const stats of [report.workers.main, report.workers.patch]) {
    if (!stats) continue;
    const live = stats.liveVersionId === stats.versionId ? "live" : `NOT LIVE (live ${stats.liveVersionId ?? "?"})`;
    console.log(`${stats.worker}: version ${stats.versionId} ${live}, run ${stats.run.url} (${stats.run.createdAt})`);
    if (stats.assetFiles !== null) line(`  static asset files`, stats.assetFiles, L.staticAssetFilesPerVersion);
    if (stats.gzipKiB !== null) line(`  gzip upload`, Math.round(stats.gzipKiB), L.workerGzipKiB, " KiB");
  }
  const assets = report.staticAssets;
  if (assets) {
    console.log(`main cf:assets check: ${n(assets.used)} used / ${n(assets.budget)} budget (${n(assets.budget - assets.used)} to budget)`);
    if (assets.largestPath) console.log(`  largest: ${assets.largestMiB} MiB ${assets.largestPath} (limit 25 MiB)`);
    for (const [group, count] of Object.entries(assets.groups ?? {}).slice(0, 15)) {
      console.log(`  ${String(count).padStart(6)}  ${group}`);
    }
  }
  if (report.d1) {
    for (const db of report.d1) line(`D1 ${db.name} storage`, Math.round(db.bytes / 1e6), L.d1BytesPerDatabase / 1e6, " MB");
  }
  if (report.today) {
    const requests = Object.values(report.today.requestsByScript).reduce((sum, value) => sum + value, 0);
    line(`requests since ${report.today.since}`, requests, L.requestsPerDay);
    const d1 = Object.values(report.today.d1ByDatabase);
    line(`D1 rows read today`, d1.reduce((sum, value) => sum + value.rowsRead, 0), L.d1RowsReadPerDay);
    line(`D1 rows written today`, d1.reduce((sum, value) => sum + value.rowsWritten, 0), L.d1RowsWrittenPerDay);
  }
  for (const error of report.errors) console.error(`error: ${error}`);
  process.exit(report.errors.length ? 1 : 0);
}

void main();

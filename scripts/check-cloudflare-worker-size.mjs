import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const limitKiB = Number(process.env.CLOUDFLARE_WORKER_SIZE_LIMIT_KIB ?? 3072);
const outDir = process.env.CLOUDFLARE_WORKER_SIZE_OUTDIR
  ?? path.join(os.tmpdir(), `sts-worker-size-check-${process.pid}`);

if (!Number.isFinite(limitKiB) || limitKiB <= 0) {
  throw new Error(`Invalid CLOUDFLARE_WORKER_SIZE_LIMIT_KIB: ${process.env.CLOUDFLARE_WORKER_SIZE_LIMIT_KIB}`);
}

rmSync(outDir, { recursive: true, force: true });

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "deploy",
    "--config",
    "wrangler.jsonc",
    "--dry-run",
    "--outdir",
    outDir,
  ],
  {
    encoding: "utf8",
    env: process.env,
  },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const match = output.match(/Total Upload:\s*([\d.]+)\s+KiB\s*\/\s*gzip:\s*([\d.]+)\s+KiB/);
if (!match) {
  console.error("Could not parse Wrangler dry-run upload size.");
  process.exit(1);
}

const totalKiB = Number(match[1]);
const gzipKiB = Number(match[2]);
if (!Number.isFinite(totalKiB) || !Number.isFinite(gzipKiB)) {
  console.error(`Invalid Wrangler dry-run upload size: ${match[0]}`);
  process.exit(1);
}

console.log(`Cloudflare Worker upload size: ${totalKiB.toFixed(2)} KiB / gzip ${gzipKiB.toFixed(2)} KiB`);
console.log(`Cloudflare Worker gzip size limit: ${limitKiB.toFixed(2)} KiB`);

if (gzipKiB > limitKiB) {
  console.error(`Cloudflare Worker gzip upload size exceeds the Free plan limit by ${(gzipKiB - limitKiB).toFixed(2)} KiB.`);
  process.exit(1);
}

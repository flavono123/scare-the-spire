import fs from "fs/promises";
import path from "path";

type TraceManifest = {
  files: string[];
};

type TraceFile = {
  path: string;
  size: number;
};

type TraceReport = {
  traceFile: string;
  totalSize: number;
  staticAssetSize: number;
  topFiles: TraceFile[];
  topStaticAssetFiles: TraceFile[];
};

const serverAppDir = path.join(process.cwd(), ".next/server/app");
const functionSizeLimitMb = Number(process.env.VERCEL_FUNCTION_TRACE_LIMIT_MB ?? 250);
const functionSizeLimitBytes = functionSizeLimitMb * 1024 * 1024;
const staticAssetLimitMb = Number(process.env.STS2_STATIC_ASSET_TRACE_LIMIT_MB ?? 100);
const staticAssetLimitBytes = staticAssetLimitMb * 1024 * 1024;

const STS2_STATIC_ASSET_PATTERNS = [
  "/public/images/sts2/",
  "/public/spine/sts2/",
];

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  }));

  return files.flat();
}

function normalizePath(filePath: string): string {
  return `/${path.relative(process.cwd(), filePath).replaceAll(path.sep, "/")}`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function isSts2StaticAsset(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return STS2_STATIC_ASSET_PATTERNS.some((pattern) => normalized.includes(pattern));
}

async function traceReport(traceFile: string): Promise<TraceReport> {
  const manifest = JSON.parse(await fs.readFile(traceFile, "utf-8")) as TraceManifest;
  const files = await Promise.all(manifest.files.map(async (file) => {
    const fullPath = path.resolve(path.dirname(traceFile), file);
    const stat = await fs.stat(fullPath).catch(() => null);
    return {
      path: fullPath,
      size: stat?.size ?? 0,
    };
  }));

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const topFiles = [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 8);
  const staticAssetFiles = files.filter((file) => isSts2StaticAsset(file.path));
  const staticAssetSize = staticAssetFiles.reduce((sum, file) => sum + file.size, 0);
  const topStaticAssetFiles = [...staticAssetFiles]
    .sort((a, b) => b.size - a.size)
    .slice(0, 8);

  return { traceFile, totalSize, staticAssetSize, topFiles, topStaticAssetFiles };
}

function printFailure(report: TraceReport): void {
  console.error(`- ${path.relative(process.cwd(), report.traceFile)} (${formatBytes(report.totalSize)})`);

  if (report.totalSize > functionSizeLimitBytes) {
    console.error(`  exceeds ${functionSizeLimitMb}MB function trace budget`);
  }

  if (report.staticAssetSize > staticAssetLimitBytes) {
    console.error(`  traces ${formatBytes(report.staticAssetSize)} of STS2 static assets, exceeding ${staticAssetLimitMb}MB asset trace budget`);
    for (const file of report.topStaticAssetFiles) {
      console.error(`    ${formatBytes(file.size)} ${normalizePath(file.path)}`);
    }
  }

  console.error("  largest traced files:");
  for (const file of report.topFiles) {
    console.error(`    ${formatBytes(file.size)} ${normalizePath(file.path)}`);
  }
}

async function main() {
  let traceFiles: string[];
  try {
    traceFiles = (await walk(serverAppDir))
      .filter((file) => file.endsWith(".nft.json"));
  } catch {
    return;
  }

  const reports = await Promise.all(traceFiles.map(traceReport));
  const failures = reports.filter((report) => (
    report.totalSize > functionSizeLimitBytes ||
    report.staticAssetSize > staticAssetLimitBytes
  ));

  if (failures.length > 0) {
    console.error("Vercel function trace check failed.");
    for (const failure of failures) {
      printFailure(failure);
    }
    process.exit(1);
  }

  const largest = reports.reduce<TraceReport | null>((current, report) => (
    !current || report.totalSize > current.totalSize ? report : current
  ), null);

  const largestLabel = largest
    ? `${path.relative(process.cwd(), largest.traceFile)} at ${formatBytes(largest.totalSize)}`
    : "no traces";
  console.log(`Vercel function trace check passed: ${reports.length} traces, largest ${largestLabel}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

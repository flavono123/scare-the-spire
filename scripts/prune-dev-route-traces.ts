import fs from "fs/promises";
import path from "path";

type TraceManifest = {
  version: number;
  files: string[];
};

const serverAppDir = path.join(process.cwd(), ".next/server/app");
const DEV_ROUTE_SEGMENT = `${path.sep}dev${path.sep}`;
const DEV_TOOLS_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "1"
  || process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "true";

const DEV_ROUTE_PRUNE_PATTERNS = [
  "/public/images/",
  "/public/fonts/",
  "/data/",
  "/scripts/",
  "/src/app/(main)/dev/",
];

const PRODUCTION_PRUNE_PATTERNS = [
  "/next/dist/server/dev/",
  "/react/cjs/react.development.js",
];

const PRODUCTION_DEV_ROUTE_PRUNE_PATTERNS = [
  "/chunks/src_lib_dev-tools_",
  "/chunks/ssr/_next-internal_server_app_(main)_dev_",
  "/chunks/ssr/src_app_(main)_dev_",
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

function shouldPrune(file: string, patterns: string[]): boolean {
  const normalized = `/${file.replaceAll(path.sep, "/")}`;
  return patterns.some((pattern) => normalized.includes(pattern));
}

function isDevRouteTrace(traceFile: string): boolean {
  return traceFile.includes(DEV_ROUTE_SEGMENT);
}

function prunePatternsForTrace(traceFile: string): string[] {
  const patterns = isDevRouteTrace(traceFile) ? [...DEV_ROUTE_PRUNE_PATTERNS] : [];

  if (!DEV_TOOLS_BUILD_ENABLED) {
    patterns.push(...PRODUCTION_PRUNE_PATTERNS);

    if (isDevRouteTrace(traceFile)) {
      patterns.push(...PRODUCTION_DEV_ROUTE_PRUNE_PATTERNS);
    }
  }

  return patterns;
}

async function pruneTrace(traceFile: string): Promise<{ before: number; after: number }> {
  const patterns = prunePatternsForTrace(traceFile);
  if (patterns.length === 0) return { before: 0, after: 0 };

  const manifest = JSON.parse(await fs.readFile(traceFile, "utf-8")) as TraceManifest;
  const before = manifest.files.length;
  const files = manifest.files.filter((file) => !shouldPrune(file, patterns));

  if (files.length !== before) {
    await fs.writeFile(
      traceFile,
      JSON.stringify({ version: manifest.version, files }),
    );
  }

  return { before, after: files.length };
}

async function main() {
  let traceFiles: string[];
  try {
    traceFiles = (await walk(serverAppDir))
      .filter((file) => file.endsWith(".nft.json"))
      .filter((file) => !DEV_TOOLS_BUILD_ENABLED || isDevRouteTrace(file));
  } catch {
    return;
  }

  const results = await Promise.all(traceFiles.map(async (traceFile) => ({
    traceFile,
    ...(await pruneTrace(traceFile)),
  })));
  const pruned = results.filter((result) => result.before !== result.after);

  if (pruned.length === 0) return;

  console.log("Pruned dev route traces:");
  for (const result of pruned) {
    const relative = path.relative(process.cwd(), result.traceFile);
    console.log(`- ${relative}: ${result.before} -> ${result.after}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

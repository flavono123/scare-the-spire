import fs from "fs/promises";
import path from "path";

type TraceManifest = {
  version: number;
  files: string[];
};

const serverAppDir = path.join(process.cwd(), ".next/server/app");
const DEV_ROUTE_SEGMENT = `${path.sep}dev${path.sep}`;

const PRUNE_PATTERNS = [
  "/public/images/",
  "/public/fonts/",
  "/data/",
  "/scripts/",
  "/src/app/(main)/dev/",
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

function shouldPrune(file: string): boolean {
  const normalized = `/${file.replaceAll(path.sep, "/")}`;
  return PRUNE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

async function pruneTrace(traceFile: string): Promise<{ before: number; after: number }> {
  const manifest = JSON.parse(await fs.readFile(traceFile, "utf-8")) as TraceManifest;
  const before = manifest.files.length;
  const files = manifest.files.filter((file) => !shouldPrune(file));

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
      .filter((file) => file.includes(DEV_ROUTE_SEGMENT));
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

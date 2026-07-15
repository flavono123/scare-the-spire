import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outputs = [
  "public/generated/comment-entities-sts2.json",
  "public/comment-entities/sts2",
];
const sources = [
  "data/sts2",
  "src/lib",
  "scripts/generate-static-api-data.ts",
  "scripts/ensure-comment-entities.mjs",
];

async function newestMtime(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const stat = await fs.stat(absolutePath);
  if (!stat.isDirectory()) return stat.mtimeMs;

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  let newest = stat.mtimeMs;
  for (const entry of entries) {
    const entryMtime = await newestMtime(path.join(relativePath, entry.name));
    newest = Math.max(newest, entryMtime);
  }
  return newest;
}

async function oldestUsableOutputMtime() {
  try {
    const stats = await Promise.all(
      outputs.map((output) => fs.stat(path.join(root, output))),
    );
    if (stats.some((stat) => !stat.isFile() || stat.size === 0)) return null;
    return Math.min(...stats.map((stat) => stat.mtimeMs));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function commentEntitiesAreFresh() {
  const outputMtime = await oldestUsableOutputMtime();
  if (outputMtime === null) return false;

  let sourceMtime = 0;
  for (const source of sources) {
    sourceMtime = Math.max(sourceMtime, await newestMtime(source));
  }
  return outputMtime >= sourceMtime;
}

if (await commentEntitiesAreFresh()) {
  process.exit(0);
}

console.log("Preparing comment entity data...");
const result = spawnSync(
  "pnpm",
  ["exec", "tsx", "scripts/generate-static-api-data.ts", "--comment-entities-only"],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);

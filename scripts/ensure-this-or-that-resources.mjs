import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const sentinel = "public/generated/this-or-that-resources-kor.json";
const sources = [
  "data/sts2",
  "src/lib/this-or-that.ts",
  "src/lib/this-or-that-data.ts",
  "scripts/generate-static-api-data.ts",
  "scripts/ensure-this-or-that-resources.mjs",
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

async function resourcesAreFresh() {
  try {
    const stat = await fs.stat(path.join(root, sentinel));
    if (!stat.isFile() || stat.size === 0) return false;

    let sourceMtime = 0;
    for (const source of sources) {
      try {
        sourceMtime = Math.max(sourceMtime, await newestMtime(source));
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
    }
    return stat.mtimeMs >= sourceMtime;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

if (await resourcesAreFresh()) {
  process.exit(0);
}

console.log("Preparing this-or-that resource data...");
const result = spawnSync(
  "pnpm",
  ["exec", "tsx", "scripts/generate-static-api-data.ts", "--this-or-that-resources-only"],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);

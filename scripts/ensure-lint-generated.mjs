import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const targets = [
  {
    output: "src/generated/borrowed-game-copy.json",
    flag: "--borrowed-game-copy-only",
    sources: [
      "data/i18n",
      "data/sts2",
      "src/lib/borrowed-game-copy.ts",
      "scripts/generate-static-api-data.ts",
      "scripts/ensure-lint-generated.mjs",
    ],
  },
  {
    output: "src/generated/toy-box-news.json",
    flag: "--toy-box-news-only",
    sources: [
      "data/byrdispatch",
      "src/lib/byrdispatch.ts",
      "src/lib/toy-box-news.ts",
      "scripts/generate-static-api-data.ts",
      "scripts/ensure-lint-generated.mjs",
    ],
  },
  {
    output: "src/generated/history-course-catalog.json",
    flag: "--history-course-catalog-only",
    sources: [
      "data/sts2",
      "src/lib/codex-data.ts",
      "src/lib/codex-types.ts",
      "scripts/generate-static-api-data.ts",
      "scripts/ensure-lint-generated.mjs",
    ],
  },
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

async function outputIsFresh(output, sources) {
  try {
    const stat = await fs.stat(path.join(root, output));
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

function runGenerate(flag) {
  console.log(`Preparing lint-generated data (${flag})...`);
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/generate-static-api-data.ts", flag],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

for (const target of targets) {
  if (!(await outputIsFresh(target.output, target.sources))) {
    runGenerate(target.flag);
  }
}

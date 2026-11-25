import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const STAGE2 = "scripts/generate-static-api-data.ts";

// Stage 1 targets come first: stage 2 imports modules that read their output.
const targets = [
  {
    output: "src/generated/borrowed-game-copy.json",
    script: "scripts/generate-source-json.ts",
    sources: [
      "data/i18n",
      "data/sts2",
      "src/lib/borrowed-game-copy-types.ts",
      "scripts/lib/source-json-payloads.ts",
      "scripts/generate-source-json.ts",
      "scripts/ensure-lint-generated.mjs",
    ],
  },
  {
    output: "src/generated/toy-box-news.json",
    script: "scripts/generate-source-json.ts",
    sources: [
      "data/byrdispatch",
      "src/lib/byrdispatch.ts",
      "src/lib/toy-box-news-types.ts",
      "scripts/lib/source-json-payloads.ts",
      "scripts/generate-source-json.ts",
      "scripts/ensure-lint-generated.mjs",
    ],
  },
  {
    output: "src/generated/history-course-catalog.json",
    script: STAGE2,
    flag: "--history-course-catalog-only",
    sources: [
      "data/sts2",
      "src/lib/codex-data.ts",
      "src/lib/codex-types.ts",
      "scripts/generate-static-api-data.ts",
      "scripts/ensure-lint-generated.mjs",
    ],
  },
  {
    output: "src/generated/history-last-scene-catalog.json",
    script: STAGE2,
    flag: "--history-course-catalog-only",
    sources: [
      "data/sts2",
      "src/lib/codex-data.ts",
      "src/lib/codex-types.ts",
      "scripts/generate-static-api-data.ts",
      "scripts/ensure-lint-generated.mjs",
    ],
  },
  {
    output: "public/generated/history-loc/eng.json",
    script: STAGE2,
    flag: "--history-loc-tables-only",
    sources: [
      "data/sts2/localization",
      "src/lib/history-loc-tables.ts",
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

function runGenerate(script, flag) {
  const args = flag ? [script, flag] : [script];
  console.log(`Preparing lint-generated data (${args.join(" ")})...`);
  const result = spawnSync("pnpm", ["exec", "tsx", ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

// In target order, so stage 1 is written before stage 2 loads it; one run per command.
const ran = new Set();
for (const target of targets) {
  const key = `${target.script} ${target.flag ?? ""}`;
  if (ran.has(key) || (await outputIsFresh(target.output, target.sources))) continue;
  runGenerate(target.script, target.flag);
  ran.add(key);
}

const spinePlayerSource = path.join(
  root,
  "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.min.js",
);
const spinePlayerOutput = path.join(root, "public/generated/spine-player.min.js");
try {
  const [outputStat, sourceStat] = await Promise.all([
    fs.stat(spinePlayerOutput).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    }),
    fs.stat(spinePlayerSource),
  ]);
  if (!outputStat?.isFile() || outputStat.size === 0 || outputStat.mtimeMs < sourceStat.mtimeMs) {
    await fs.mkdir(path.dirname(spinePlayerOutput), { recursive: true });
    await fs.copyFile(spinePlayerSource, spinePlayerOutput);
    console.log("Copied public/generated/spine-player.min.js");
  }
} catch (error) {
  if (error?.code === "ENOENT") {
    console.warn("Spine player runtime is missing from node_modules; skip copy.");
  } else {
    throw error;
  }
}

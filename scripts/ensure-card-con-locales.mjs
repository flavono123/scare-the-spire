import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const locales = [
  "eng",
  "zhs",
  "jpn",
  "deu",
  "fra",
  "ita",
  "spa",
  "esp",
  "ptb",
  "rus",
  "pol",
  "tha",
  "tur",
];

async function missingLocaleFile() {
  for (const locale of locales) {
    const filePath = path.join(root, "public/generated", `card-con-locale-${locale}.json`);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size === 0) return true;
    } catch (error) {
      if (error?.code === "ENOENT") return true;
      throw error;
    }
  }
  return false;
}

if (!(await missingLocaleFile())) {
  process.exit(0);
}

console.log("Preparing card-con game locale text...");
// Stage 2 loads modules that import the stage-1 src/generated JSON; write it first.
const stage1 = spawnSync("pnpm", ["exec", "tsx", "scripts/generate-source-json.ts"], { cwd: root, stdio: "inherit" });
if (stage1.error) throw stage1.error;
if (stage1.status) process.exit(stage1.status);
const result = spawnSync(
  "pnpm",
  ["exec", "tsx", "scripts/generate-static-api-data.ts", "--card-con-locales-only"],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);

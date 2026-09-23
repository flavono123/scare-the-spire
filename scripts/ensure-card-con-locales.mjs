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

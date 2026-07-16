import { mkdirSync, readdirSync, copyFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const appDir = path.join(".next", "server", "app");
const outDir = path.join(".open-next", "assets", "_cf_static_pages");
const gameLocalePathSegments = new Set([
  "en",
  "zh",
  "ja",
  "de",
  "fr",
  "it",
  "es",
  "es-419",
  "pt",
  "ru",
  "pl",
  "th",
  "tr",
]);
const compendiumSegments = new Set([
  "ancients",
  "bestiary",
  "cards",
  "characters",
  "enchantments",
  "encounters",
  "epochs",
  "events",
  "keywords",
  "monsters",
  "potions",
  "powers",
  "relics",
]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function staticPageRelativePath(file) {
  const relative = path.relative(appDir, file);
  const parsed = path.parse(relative);
  if (parsed.ext !== ".html" && parsed.ext !== ".rsc") return null;

  const parts = parsed.dir.split(path.sep).filter(Boolean);
  if (parts.length === 0 && (parsed.name === "index" || gameLocalePathSegments.has(parsed.name))) {
    return `${parsed.name}${parsed.ext}`;
  }

  const compendiumIndex = parts.indexOf("compendium");
  if (compendiumIndex < 0 || compendiumIndex > 1) return null;

  const isIndex = parts.length === compendiumIndex + 1 && compendiumSegments.has(parsed.name);
  const isServiceLocaleDetail =
    parts.length === compendiumIndex + 2
    && compendiumSegments.has(parts[compendiumIndex + 1])
    && (compendiumIndex === 0 || parts[0] === "en");
  if (!isIndex && !isServiceLocaleDetail) return null;

  return path.join(parsed.dir, `${parsed.name}${parsed.ext}`);
}

if (!statSync(appDir, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`${appDir} does not exist. Run the Next/OpenNext build before copying static pages.`);
}

rmSync(outDir, { recursive: true, force: true });

let count = 0;
for (const file of walk(appDir)) {
  const relative = staticPageRelativePath(file);
  if (!relative) continue;

  const output = path.join(outDir, relative);
  mkdirSync(path.dirname(output), { recursive: true });
  copyFileSync(file, output);
  count += 1;
}

if (count === 0) {
  throw new Error("No Cloudflare static HTML/RSC files were copied.");
}

console.log(`Copied ${count} Cloudflare static page asset(s) to ${outDir}`);

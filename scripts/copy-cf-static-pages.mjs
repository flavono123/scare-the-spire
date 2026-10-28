import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const appDir = path.join(".next", "server", "app");
const assetsDir = path.join(".open-next", "assets");
const outDir = path.join(assetsDir, "_cf_static_pages");
const staticMetadataFiles = [
  { source: "robots.txt.body", target: "robots.txt" },
  { source: "sitemap.xml.body", target: "sitemap.xml" },
];
// Mirrors GAME_LOCALE_BY_PATH_SEGMENT in src/lib/i18n.ts.
const gameLocaleByPathSegment = {
  en: "eng",
  zh: "zhs",
  ja: "jpn",
  de: "deu",
  fr: "fra",
  it: "ita",
  es: "spa",
  "es-419": "esp",
  pt: "ptb",
  ru: "rus",
  pl: "pol",
  th: "tha",
  tr: "tur",
};
const gameLocalePathSegments = new Set(Object.keys(gameLocaleByPathSegment));
const compendiumSegments = new Set([
  "ancients",
  "badges",
  "bestiary",
  "cards",
  "characters",
  "enchantments",
  "encounters",
  "epochs",
  "events",
  "keywords",
  "modifiers",
  "ascensions",
  "monsters",
  "potions",
  "powers",
  "relics",
]);
const staticServicePageSegments = new Set([
  "byrdispatch",
  "chemical-x",
  "c-c-c-combo",
  "contact",
  "defragment",
  "history-course",
  "profile",
  "this-or-that",
  "transfigure",
  "pagestorm",
  "colorful-philosophers",
]);
const staticNestedServicePages = [
  ["pagestorm", "write"],
];
const staticDetailShellSegment = "__id__";
const staticServiceDetailSegments = new Set([
  "chemical-x",
  "c-c-c-combo",
  "this-or-that",
  "transfigure",
  "history-course",
  "decisions-decisions",
  "defragment",
  "pagestorm",
  "colorful-philosophers",
]);
const defragmentFederatedServices = new Set([
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
  "decisions_decisions",
  "favorite_tournament",
  "pagestorm",
  "history_course",
]);
const sts1CompendiumSegments = new Set([
  "cards",
  "characters",
  "potions",
  "powers",
  "relics",
]);
// Only the ko static Compendium detail document needs GC Batang's common-character
// subset (compendium-direct-detail-route.tsx). React Flight also writes that
// preload into the page's RSC payload as a hint row, and the Flight client applies
// hint rows as soon as it parses them, so a <Link> prefetch of a ko detail would
// fetch the subset on whatever page is open. Hint rows are not referenced by other
// rows; the HTML keeps its <link rel="preload">.
const staticDetailSubsetHref = "/fonts/GyeonggiCheonnyeonBatangBold-common.woff2";
const staticDetailSubsetHintRow =
  /^:HL\["\/fonts\/GyeonggiCheonnyeonBatangBold-common\.woff2",[^\n]*\n/gm;

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

  const isDefaultLocaleServicePage = parts.length === 0 && staticServicePageSegments.has(parsed.name);
  const isGameLocaleServicePage =
    parts.length === 1
    && gameLocalePathSegments.has(parts[0])
    && staticServicePageSegments.has(parsed.name);
  if (isDefaultLocaleServicePage || isGameLocaleServicePage) {
    return path.join(parsed.dir, `${parsed.name}${parsed.ext}`);
  }

  const isDefaultNestedServicePage =
    parts.length === 1
    && staticNestedServicePages.some(([service, nested]) => (
      parts[0] === service && parsed.name === nested
    ));
  const isGameLocaleNestedServicePage =
    parts.length === 2
    && gameLocalePathSegments.has(parts[0])
    && staticNestedServicePages.some(([service, nested]) => (
      parts[1] === service && parsed.name === nested
    ));
  if (isDefaultNestedServicePage || isGameLocaleNestedServicePage) {
    return path.join(parsed.dir, `${parsed.name}${parsed.ext}`);
  }

  const isDefaultLocaleDetailShell =
    parsed.name === staticDetailShellSegment
    && parts.length === 1
    && staticServiceDetailSegments.has(parts[0]);
  const isGameLocaleDetailShell =
    parsed.name === staticDetailShellSegment
    && parts.length === 2
    && gameLocalePathSegments.has(parts[0])
    && staticServiceDetailSegments.has(parts[1]);
  const isDefaultFederatedDetailShell =
    parsed.name === staticDetailShellSegment
    && parts.length === 2
    && parts[0] === "defragment"
    && defragmentFederatedServices.has(parts[1]);
  const isGameLocaleFederatedDetailShell =
    parsed.name === staticDetailShellSegment
    && parts.length === 3
    && gameLocalePathSegments.has(parts[0])
    && parts[1] === "defragment"
    && defragmentFederatedServices.has(parts[2]);
  const isDefaultTournamentDetailShell =
    parsed.name === staticDetailShellSegment
    && parts.length === 2
    && parts[0] === "this-or-that"
    && parts[1] === "tournament";
  const isGameLocaleTournamentDetailShell =
    parsed.name === staticDetailShellSegment
    && parts.length === 3
    && gameLocalePathSegments.has(parts[0])
    && parts[1] === "this-or-that"
    && parts[2] === "tournament";
  if (
    isDefaultLocaleDetailShell
    || isGameLocaleDetailShell
    || isDefaultFederatedDetailShell
    || isGameLocaleFederatedDetailShell
    || isDefaultTournamentDetailShell
    || isGameLocaleTournamentDetailShell
  ) {
    return path.join(parsed.dir, `${parsed.name}${parsed.ext}`);
  }

  const isDefaultCompendiumRoot = parts.length === 0 && parsed.name === "compendium";
  const isGameLocaleCompendiumRoot =
    parts.length === 1
    && gameLocalePathSegments.has(parts[0])
    && parsed.name === "compendium";
  if (isDefaultCompendiumRoot || isGameLocaleCompendiumRoot) {
    return path.join(parsed.dir, `${parsed.name}${parsed.ext}`);
  }

  const compendiumIndex = parts.indexOf("compendium");
  if (compendiumIndex < 0 || compendiumIndex > 1) return null;

  const isIndex = parts.length === compendiumIndex + 1 && compendiumSegments.has(parsed.name);
  const isServiceLocaleDetail =
    parts.length === compendiumIndex + 2
    && compendiumSegments.has(parts[compendiumIndex + 1])
    && (compendiumIndex === 0 || parts[0] === "en");
  const isSts1Index =
    parts.length === compendiumIndex + 2
    && parts[compendiumIndex + 1] === "sts1"
    && sts1CompendiumSegments.has(parsed.name);
  const isSts1Detail =
    parts.length === compendiumIndex + 3
    && parts[compendiumIndex + 1] === "sts1"
    && sts1CompendiumSegments.has(parts[compendiumIndex + 2])
    && (compendiumIndex === 0 || parts[0] === "en");
  if (!isIndex && !isServiceLocaleDetail && !isSts1Index && !isSts1Detail) return null;

  return path.join(parsed.dir, `${parsed.name}${parsed.ext}`);
}

function documentGameLocale(relative) {
  const parsed = path.parse(relative);
  if (parsed.ext !== ".html") return null;
  const segment = parsed.dir ? relative.split(path.sep)[0] : parsed.name;
  return gameLocaleByPathSegment[segment] ?? null;
}

function setHtmlTagAttribute(tag, name, value) {
  const attribute = new RegExp(`\\s${name}="[^"]*"`);
  return attribute.test(tag)
    ? tag.replace(attribute, ` ${name}="${value}"`)
    : tag.replace(/^<html\b/, `<html ${name}="${value}"`);
}

/**
 * The shared root layout prerenders <html lang="ko">. Locale-prefixed pages use
 * the English service UI, so fix the document attributes before serving them.
 * Error shells (<html id="__next_error__">) have none, so they are added.
 */
function localizeDocumentRoot(html, gameLocale, relative) {
  const match = /<html\b[^>]*>/.exec(html);
  if (!match) throw new Error(`No <html> tag in ${relative}`);
  const tag = [
    ["lang", "en"],
    ["data-service-locale", "en"],
    ["data-game-locale", gameLocale],
  ].reduce((current, [name, value]) => setHtmlTagAttribute(current, name, value), match[0]);
  return `${html.slice(0, match.index)}${tag}${html.slice(match.index + match[0].length)}`;
}

function stripStaticDetailSubsetHint(rsc, relative) {
  const stripped = rsc.replace(staticDetailSubsetHintRow, "");
  if (stripped.includes(staticDetailSubsetHref)) {
    throw new Error(`${relative} still references ${staticDetailSubsetHref} outside a hint row`);
  }
  return stripped;
}

if (!statSync(appDir, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`${appDir} does not exist. Run the Next/OpenNext build before copying static pages.`);
}

rmSync(outDir, { recursive: true, force: true });

let count = 0;
let localizedCount = 0;
let strippedHintCount = 0;
for (const file of walk(appDir)) {
  const relative = staticPageRelativePath(file);
  if (!relative) continue;

  const output = path.join(outDir, relative);
  mkdirSync(path.dirname(output), { recursive: true });
  const gameLocale = documentGameLocale(relative);
  if (gameLocale) {
    writeFileSync(output, localizeDocumentRoot(readFileSync(file, "utf8"), gameLocale, relative));
    localizedCount += 1;
  } else if (relative.endsWith(".rsc") && readFileSync(file).includes(staticDetailSubsetHref)) {
    writeFileSync(output, stripStaticDetailSubsetHint(readFileSync(file, "utf8"), relative));
    strippedHintCount += 1;
  } else {
    copyFileSync(file, output);
  }
  count += 1;
}

if (count === 0) {
  throw new Error("No Cloudflare static HTML/RSC files were copied.");
}

console.log(`Copied ${count} Cloudflare static page asset(s) to ${outDir} (${localizedCount} with an English document root, ${strippedHintCount} RSC without the static detail font subset hint)`);

for (const metadataFile of staticMetadataFiles) {
  const source = path.join(appDir, metadataFile.source);
  if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing generated metadata body: ${source}`);
  }
  copyFileSync(source, path.join(assetsDir, metadataFile.target));
}

console.log(`Copied ${staticMetadataFiles.length} Cloudflare static metadata asset(s) to ${assetsDir}`);

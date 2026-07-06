import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const patchAssetsDir = path.join(projectRoot, ".patch-worker", "assets");
const publicDir = path.join(projectRoot, "public");
const appDir = path.join(projectRoot, "src", "app");

const copied = new Set();

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(filePath));
    } else {
      files.push(filePath);
    }
  }

  return files;
}

function normalizePublicPath(rawPath) {
  const pathWithoutQuery = rawPath.split(/[?#]/, 1)[0];
  try {
    return decodeURI(pathWithoutQuery);
  } catch {
    return pathWithoutQuery;
  }
}

function collectPublicAssetRefs(text) {
  const refs = new Set();
  const patterns = [
    /(?:src|href)=["'](\/(?:images|fonts)\/[^"?#']+)(?:[?#][^"']*)?["']/g,
    /url\(["']?(\/(?:images|fonts)\/[^"')?#]+)(?:[?#][^"')]+)?["']?\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      refs.add(normalizePublicPath(match[1]));
    }
  }

  return refs;
}

async function copyPublicAsset(publicPath) {
  if (!publicPath.startsWith("/")) {
    throw new Error(`Expected absolute public path: ${publicPath}`);
  }
  if (copied.has(publicPath)) return;

  const relativePath = publicPath.slice(1);
  const publicSourcePath = path.join(publicDir, relativePath);
  const appSourcePath = path.join(appDir, relativePath);
  const destinationPath = path.join(patchAssetsDir, relativePath);
  const sourcePath = await fs.stat(publicSourcePath)
    .then(() => publicSourcePath)
    .catch(async () => {
      await fs.stat(appSourcePath);
      return appSourcePath;
    });

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  copied.add(publicPath);
}

async function main() {
  const sourceFiles = await walk(patchAssetsDir);
  const assetRefs = new Set([
    "/fonts/spectral_bold.ttf",
    "/fonts/kreon_regular.ttf",
    "/fonts/kreon_bold.ttf",
    "/fonts/GyeonggiCheonnyeonBatangBold.woff2",
    "/favicon.ico",
    "/apple-icon.png",
    "/site.webmanifest",
    "/images/sts2/characters/character_icon_defect.webp",
    "/images/sts2/characters/character_icon_ironclad.webp",
    "/images/sts2/characters/character_icon_necrobinder.webp",
    "/images/sts2/characters/character_icon_regent.webp",
    "/images/sts2/characters/character_icon_silent.webp",
  ]);

  for (const filePath of sourceFiles) {
    if (!/\.(?:html|css)$/.test(filePath)) continue;
    const text = await fs.readFile(filePath, "utf8");
    for (const ref of collectPublicAssetRefs(text)) {
      assetRefs.add(ref);
    }
  }

  for (const ref of assetRefs) {
    await copyPublicAsset(ref);
  }

  console.log(`Copied ${copied.size} patch Worker public assets`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

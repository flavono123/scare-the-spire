import { access, readdir } from "fs/promises";
import path from "path";
import {
  DEFAULT_PAGE_OG_IMAGE,
  PAGE_OG_IMAGE_RULES,
  findPageOgImageRule,
  getPageOgImage,
  type PageOgImage,
} from "../src/lib/page-og-images";

const appDir = path.join(process.cwd(), "src/app");
const publicDir = path.join(process.cwd(), "public");
const showAllPages = process.argv.includes("--all");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  }));

  return files.flat();
}

function pageFileToRoute(file: string): string {
  const relativeParts = path.relative(appDir, file).split(path.sep);
  const routeParts = relativeParts
    .slice(0, -1)
    .filter((part) => !part.startsWith("(") && !part.startsWith("@"));
  const route = `/${routeParts.join("/")}`.replace(/\/+/g, "/").replace(/\/$/, "");
  return route || "/";
}

function localImagePath(image: PageOgImage): string | null {
  if (!image.url.startsWith("/")) return null;
  return path.join(publicDir, image.url.replace(/^\//, ""));
}

const imageStatusCache = new Map<string, Promise<boolean>>();

async function imageExists(image: PageOgImage): Promise<boolean> {
  const localPath = localImagePath(image);
  if (!localPath) return true;

  const cached = imageStatusCache.get(localPath);
  if (cached) return cached;

  const status = access(localPath).then(
    () => true,
    () => false,
  );
  imageStatusCache.set(localPath, status);
  return status;
}

function statusLabel(ok: boolean): string {
  return ok ? "OK" : "MISSING";
}

async function main() {
  const pageFiles = (await walk(appDir))
    .filter((file) => file.endsWith(`${path.sep}page.tsx`))
    .sort();
  const pageRoutes = pageFiles.map(pageFileToRoute);
  const rows = await Promise.all(pageRoutes.map(async (route) => {
    const rule = findPageOgImageRule(route);
    const image = getPageOgImage(route);
    const exists = await imageExists(image);
    return {
      route,
      rule,
      image,
      exists,
    };
  }));

  const defaultExists = await imageExists(DEFAULT_PAGE_OG_IMAGE);
  const ruleStatuses = await Promise.all(PAGE_OG_IMAGE_RULES.map(async (rule) => ({
    rule,
    exists: await imageExists(rule.image),
  })));
  const mappedRows = rows.filter((row) => row.rule);
  const defaultRows = rows.filter((row) => !row.rule);
  const missingCount =
    Number(!defaultExists) +
    ruleStatuses.filter((row) => !row.exists).length +
    rows.filter((row) => !row.exists).length;

  console.log("OG image status");
  console.log(`Default: ${DEFAULT_PAGE_OG_IMAGE.url} (${statusLabel(defaultExists)})`);
  console.log("");
  console.log("Rules:");
  for (const { rule, exists } of ruleStatuses) {
    console.log(`- ${rule.pattern} -> ${rule.image.url} (${rule.label}, ${statusLabel(exists)})`);
  }
  console.log("");
  console.log(`Pages: ${rows.length} total, ${mappedRows.length} mapped, ${defaultRows.length} default`);

  if (mappedRows.length > 0) {
    console.log("");
    console.log("Mapped pages:");
    for (const row of mappedRows) {
      console.log(`- ${row.route} -> ${row.image.url} (${row.rule!.label}, ${statusLabel(row.exists)})`);
    }
  }

  if (showAllPages && defaultRows.length > 0) {
    console.log("");
    console.log("Default pages:");
    for (const row of defaultRows) {
      console.log(`- ${row.route} -> ${row.image.url} (${statusLabel(row.exists)})`);
    }
  } else if (defaultRows.length > 0) {
    console.log("");
    console.log("Default pages hidden. Run `pnpm og:status -- --all` to list them.");
  }

  if (missingCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

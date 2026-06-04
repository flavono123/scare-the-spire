import { access, readdir } from "fs/promises";
import path from "path";
import {
  DEFAULT_PAGE_OG_IMAGE,
  PAGE_OG_IMAGE_RULES,
  findPageOgImageRule,
  getPageOgImage,
  type PageOgImage,
  type PageOgImageRule,
} from "@/lib/page-og-images";

const appDir = path.join(process.cwd(), "src/app");
const publicDir = path.join(process.cwd(), "public");

export type PageOgStatusRow = {
  route: string;
  rule: PageOgImageRule | null;
  image: PageOgImage;
  exists: boolean;
};

export type PageOgRuleStatus = {
  rule: PageOgImageRule;
  exists: boolean;
};

export type PageOgStatus = {
  defaultImage: PageOgImage;
  defaultExists: boolean;
  rules: PageOgRuleStatus[];
  rows: PageOgStatusRow[];
  mappedRows: PageOgStatusRow[];
  defaultRows: PageOgStatusRow[];
  missingCount: number;
};

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

function canonicalStatusRoute(route: string): string {
  return route.replace(/^\/codex(?=\/|$)/, "/compendium");
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

export async function getPageOgStatus(): Promise<PageOgStatus> {
  const pageFiles = (await walk(appDir))
    .filter((file) => file.endsWith(`${path.sep}page.tsx`))
    .sort();
  const pageRoutes = [
    ...new Set(pageFiles.map((file) => canonicalStatusRoute(pageFileToRoute(file)))),
  ];
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
  const rules = await Promise.all(PAGE_OG_IMAGE_RULES.map(async (rule) => ({
    rule,
    exists: await imageExists(rule.image),
  })));
  const mappedRows = rows.filter((row) => row.rule);
  const defaultRows = rows.filter((row) => !row.rule);
  const missingCount =
    Number(!defaultExists) +
    rules.filter((row) => !row.exists).length +
    rows.filter((row) => !row.exists).length;

  return {
    defaultImage: DEFAULT_PAGE_OG_IMAGE,
    defaultExists,
    rules,
    rows,
    mappedRows,
    defaultRows,
    missingCount,
  };
}

export function pageOgStatusLabel(ok: boolean): "OK" | "MISSING" {
  return ok ? "OK" : "MISSING";
}

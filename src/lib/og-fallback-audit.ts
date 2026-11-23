import { access, open, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { stripGameLocaleFromPath } from "@/lib/i18n";
import {
  DEFAULT_PAGE_OG_IMAGE,
  KEYWORD_PAGE_OG_IMAGE,
  NEOWSLETTER_INDEX_OG_IMAGE,
  PAGE_OG_IMAGE_RULES,
} from "@/lib/page-og-images";
import { listPageRoutes } from "@/lib/page-og-status";

/**
 * Every built page's real og:image, read from the deploy artifacts, so a page that silently
 * took a fallback shows up whatever code path produced it.
 */

export type OgFallbackKind = "none" | "broken" | "default" | "shared";
export type OgFallbackStatus = "intended" | "undecided";
export type OgFallbackState = OgFallbackStatus | "unconfirmed";

export type OgFallbackDecision = {
  status: OgFallbackStatus;
  image: string;
  updatedAt: string;
};

export type OgFallbackGroup = {
  /** Decision key: the route template when every page of it falls back alike, else the page path. */
  key: string;
  template: string;
  kind: OgFallbackKind;
  /** Image pathname (no origin, no query); "" for kind none. */
  image: string;
  /** Page whose own image this is, for kind shared. */
  owner?: string;
  /** Locale-stripped paths, sorted. */
  paths: string[];
  /** Built HTML files behind those paths (every game locale). */
  fileCount: number;
  /** A prerendered record shell the main Worker may rewrite at request time. */
  recordShell: boolean;
  state: OgFallbackState;
};

export type OgBuildSource = {
  id: string;
  label: string;
  dir: string;
  buildCommand: string;
  builtAt: string | null;
  fileCount: number;
};

export type OgFallbackAudit = {
  sources: OgBuildSource[];
  pageCount: number;
  groups: OgFallbackGroup[];
  counts: Record<OgFallbackState, number>;
  /** Decisions whose key no longer falls back. */
  staleKeys: string[];
  detailShellOgOn: boolean;
};

const root = process.cwd();
const DECISIONS_FILE = path.join(root, "src/data/og-fallback-decisions.json");

const BUILD_SOURCES = [
  { id: "main", label: "main Worker", dir: ".cloudflare/assets/_cf_static_pages", buildCommand: "pnpm cf:build", skip: null },
  { id: "sts1", label: "STS1 Worker", dir: ".sts1-worker/assets/_cf_static_pages", buildCommand: "pnpm cf:build", skip: null },
  { id: "patch", label: "patch Worker", dir: ".patch-worker/assets", buildCommand: "pnpm patch:build", skip: /^_patches\// },
] as const;

export function imagePathname(url: string): string {
  try {
    return new URL(url, "https://x.invalid").pathname;
  } catch {
    return url.split(/[?#]/, 1)[0] ?? url;
  }
}

export type SharedOgImage = { image: string; owner: string };

/** Images several pages share, each with the one page it belongs to. */
export function sharedOgImages(): SharedOgImage[] {
  const shared: SharedOgImage[] = [
    { image: imagePathname(DEFAULT_PAGE_OG_IMAGE.url), owner: "/" },
    { image: imagePathname(NEOWSLETTER_INDEX_OG_IMAGE.url), owner: "/patches/neowsletters" },
    { image: imagePathname(KEYWORD_PAGE_OG_IMAGE.url), owner: "/compendium/keywords" },
  ];
  // The shortest exact pattern owns an image (/this-or-that, not /this-or-that/tournament).
  const exactRules = PAGE_OG_IMAGE_RULES
    .filter((rule) => !rule.pattern.endsWith("/*"))
    .sort((a, b) => a.pattern.length - b.pattern.length);
  for (const rule of exactRules) {
    const image = imagePathname(rule.image.url);
    if (!shared.some((entry) => entry.image === image)) shared.push({ image, owner: rule.pattern });
  }
  return shared;
}

/** Built file → URL path: `a/b.html` and `a/b/index.html` are `/a/b`. */
export function builtFileToPath(relativeFile: string): string {
  const withoutExt = relativeFile.split(path.sep).join("/").replace(/\.html$/, "");
  const trimmed = withoutExt === "index" ? "" : withoutExt.replace(/\/index$/, "");
  return `/${trimmed}`;
}

/** The most specific route template for a locale-stripped path, or the path itself. */
export function matchRouteTemplate(pathname: string, templates: readonly string[]): string {
  const parts = pathname.split("/").filter(Boolean);
  let best: { template: string; score: number } | null = null;
  for (const template of templates) {
    const tParts = template.split("/").filter(Boolean);
    const catchAll = tParts.length > 0 && /^\[\[?\.\.\./.test(tParts[tParts.length - 1]);
    if (catchAll ? parts.length < tParts.length - 1 : parts.length !== tParts.length) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < tParts.length; i += 1) {
      const t = tParts[i];
      if (t.startsWith("[")) continue;
      if (t !== parts[i]) {
        ok = false;
        break;
      }
      score += 1;
    }
    if (ok && (!best || score > best.score)) best = { template, score };
  }
  return best?.template ?? pathname;
}

export type BuiltPageImage = { path: string; image: string | null };

export function classifyPageImage(
  page: BuiltPageImage,
  shared: readonly SharedOgImage[],
  imageExists: (image: string) => boolean,
): { kind: OgFallbackKind; owner?: string } | null {
  if (!page.image) return { kind: "none" };
  if (page.image.startsWith("/") && !imageExists(page.image)) return { kind: "broken" };
  const entry = shared.find((candidate) => candidate.image === page.image);
  if (!entry || entry.owner === page.path) return null;
  // A resource page showing its own art (/compendium/cards/eradicate → cards/eradicate.webp).
  const stem = page.image.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "");
  if (stem && stem === page.path.split("/").pop()) return null;
  return { kind: entry.owner === "/" ? "default" : "shared", owner: entry.owner };
}

type FallbackPage = BuiltPageImage & { kind: OgFallbackKind; owner?: string; template: string; files: number };

/** Groups fallback pages under a decision key and attaches each group's decision state. */
export function groupFallbackPages(
  fallbackPages: readonly FallbackPage[],
  pagesPerTemplate: ReadonlyMap<string, number>,
  decisions: Readonly<Record<string, OgFallbackDecision>>,
): OgFallbackGroup[] {
  const byTemplate = new Map<string, FallbackPage[]>();
  for (const page of fallbackPages) {
    const list = byTemplate.get(page.template) ?? [];
    list.push(page);
    byTemplate.set(page.template, list);
  }

  const groups: OgFallbackGroup[] = [];
  const push = (key: string, pages: FallbackPage[]) => {
    const first = pages[0];
    const image = first.image ?? "";
    const decision = decisions[key];
    groups.push({
      key,
      template: first.template,
      kind: first.kind,
      image,
      owner: first.owner,
      paths: pages.map((page) => page.path).sort(),
      fileCount: pages.reduce((sum, page) => sum + page.files, 0),
      recordShell: pages.some((page) => page.path.includes("__id__")),
      state: decision && decision.image === image ? decision.status : "unconfirmed",
    });
  };

  for (const [template, pages] of byTemplate) {
    const uniform = pages.every((page) => page.kind === pages[0].kind && page.image === pages[0].image);
    const whole = uniform && pages.length === (pagesPerTemplate.get(template) ?? pages.length);
    if (whole) push(template, pages);
    else for (const page of pages) push(page.path, [page]);
  }

  const order: Record<OgFallbackState, number> = { unconfirmed: 0, undecided: 1, intended: 2 };
  return groups.sort((a, b) => order[a.state] - order[b.state] || a.key.localeCompare(b.key));
}

async function walkHtml(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkHtml(full);
    return entry.name.endsWith(".html") ? [full] : [];
  }));
  return nested.flat();
}

const HEAD_BYTES = 64 * 1024;
const ERROR_PAGES = new Set(["/404", "/500", "/_not-found", "/_global-error"]);

/** og:image of one built page, from its head only (pages run to several hundred KB). */
async function readOgImage(file: string): Promise<string | null> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
    const head = buffer.subarray(0, bytesRead).toString("utf8");
    const tag = head.match(/<meta[^>]+property="og:image"[^>]*>/i)?.[0];
    const content = tag?.match(/content="([^"]*)"/i)?.[1];
    return content ? imagePathname(content.replace(/&amp;/g, "&")) : null;
  } finally {
    await handle.close();
  }
}

export async function readOgFallbackDecisions(): Promise<Record<string, OgFallbackDecision>> {
  try {
    const parsed = JSON.parse(await readFile(DECISIONS_FILE, "utf8")) as { decisions?: Record<string, OgFallbackDecision> };
    return parsed.decisions ?? {};
  } catch {
    return {};
  }
}

export async function writeOgFallbackDecision(
  key: string,
  decision: OgFallbackDecision | null,
): Promise<void> {
  const parsed = JSON.parse(await readFile(DECISIONS_FILE, "utf8")) as Record<string, unknown> & {
    decisions?: Record<string, OgFallbackDecision>;
  };
  const decisions = { ...(parsed.decisions ?? {}) };
  if (decision) decisions[key] = decision;
  else delete decisions[key];
  const sorted = Object.fromEntries(Object.entries(decisions).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(DECISIONS_FILE, `${JSON.stringify({ ...parsed, decisions: sorted }, null, 2)}\n`);
}

async function detailShellOgOn(): Promise<boolean> {
  const config = await readFile(path.join(root, "wrangler.jsonc"), "utf8").catch(() => "");
  return /"DETAIL_SHELL_OG"\s*:\s*"d1"/.test(config);
}

export async function getOgFallbackAudit(): Promise<OgFallbackAudit> {
  const templates = (await listPageRoutes()).filter(
    (route) => !route.startsWith("/[gameLocale]") && !route.split("/").some((part) => part.startsWith("_")),
  );
  const shared = sharedOgImages();
  const existing = new Map<string, boolean>();
  const pages = new Map<string, { image: string | null; files: number }>();
  const sources: OgBuildSource[] = [];

  for (const source of BUILD_SOURCES) {
    const dir = path.join(root, source.dir);
    const builtAt = await stat(dir).then((info) => info.mtime.toISOString(), () => null);
    const files = (await walkHtml(dir)).filter((file) => !source.skip?.test(path.relative(dir, file)));
    sources.push({ id: source.id, label: source.label, dir: source.dir, buildCommand: source.buildCommand, builtAt, fileCount: files.length });

    const images = await Promise.all(files.map((file) => readOgImage(file)));
    files.forEach((file, index) => {
      const pagePath = stripGameLocaleFromPath(builtFileToPath(path.relative(dir, file)));
      const previous = pages.get(pagePath);
      // Locale copies normally agree; the first one without an image wins so a gap is not hidden.
      pages.set(pagePath, {
        image: previous ? (previous.image && images[index] ? previous.image : null) : images[index],
        files: (previous?.files ?? 0) + 1,
      });
    });
  }

  for (const { image } of pages.values()) {
    if (!image?.startsWith("/") || existing.has(image)) continue;
    existing.set(image, await access(path.join(root, "public", image)).then(() => true, () => false));
  }

  const pagesPerTemplate = new Map<string, number>();
  const fallbackPages: FallbackPage[] = [];
  for (const [pagePath, { image, files }] of pages) {
    if (ERROR_PAGES.has(pagePath)) continue;
    const template = matchRouteTemplate(pagePath, templates);
    pagesPerTemplate.set(template, (pagesPerTemplate.get(template) ?? 0) + 1);
    const result = classifyPageImage({ path: pagePath, image }, shared, (img) => existing.get(img) ?? true);
    if (result) fallbackPages.push({ path: pagePath, image, template, files, ...result });
  }

  const decisions = await readOgFallbackDecisions();
  const groups = groupFallbackPages(fallbackPages, pagesPerTemplate, decisions);
  const keys = new Set(groups.map((group) => group.key));
  const counts: Record<OgFallbackState, number> = { unconfirmed: 0, undecided: 0, intended: 0 };
  for (const group of groups) counts[group.state] += 1;

  return {
    sources,
    pageCount: pages.size,
    groups,
    counts,
    staleKeys: Object.keys(decisions).filter((key) => !keys.has(key)),
    detailShellOgOn: await detailShellOgOn(),
  };
}

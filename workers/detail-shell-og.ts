import { pagestormPostOgImage } from "../src/lib/pagestorm";
import { PAGESTORM_PAGE_OG_IMAGE } from "../src/lib/page-og-images";
import {
  chemicalPostOgImage,
  clipOgDescription,
  comboPostOgImage,
  coverOgImageFromFields,
  toyboxResourceOgImageUrl,
  truncateOgTitle,
} from "../src/lib/toybox-post-og";
import { isCoverSpec } from "../src/lib/run-cover-types";
import type { PostBlock } from "../src/lib/chemical-types";
import type { ComboResourceRef } from "../src/lib/combo-types";
import {
  CHEMICAL_X_PAGE_OG_IMAGE,
  COMBO_PAGE_OG_IMAGE,
  THIS_OR_THAT_PAGE_OG_IMAGE,
} from "../src/lib/page-og-images";
import {
  searchCanonicalPath,
  searchLanguageAlternatePaths,
} from "../src/lib/search-canonical";
import {
  getGameLocaleFromPathname,
  getServiceLocaleForGameLocale,
} from "../src/lib/i18n";
import { withTimeout, type D1Database } from "./api/d1";
import { Q_R5 } from "./api/d1-adapters/queries";
import { json, materialize, query, readAll, type Row } from "./api/d1-adapters/rows";
import { postObject, postSql, type FeedService } from "./api/d1-adapters/toybox";

interface HTMLRewriterElement {
  setInnerContent(content: string, options?: { html?: boolean }): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  append(content: string, options?: { html?: boolean }): void;
  remove(): void;
}

interface HTMLRewriterInstance {
  on(
    selector: string,
    handlers: {
      element?(element: HTMLRewriterElement): void;
    },
  ): HTMLRewriterInstance;
  transform(response: Response): Response;
}

declare const HTMLRewriter: {
  new (): HTMLRewriterInstance;
};

export interface WorkerEnv {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
  PATCH_WORKER?: {
    fetch(request: Request): Promise<Response>;
  };
  /** The main Worker's D1 copy of the data env (wrangler.jsonc d1_databases). */
  DB?: D1Database;
  /**
   * "d1" turns on per-record OG enrichment, read from DB. wrangler.jsonc does not set it, so
   * production and the testbed serve the shell's list OG, as they did while this lookup read
   * Supabase without the Worker having Supabase variables (tasks/010 #32).
   */
  DETAIL_SHELL_OG?: string;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

export interface DetailShellTarget {
  service: string;
  recordId: string;
  gameLocale: string;
}

export interface DetailShellOgData {
  title: string;
  description: string;
  image: string;
}

const STATIC_GAME_LOCALE_PREFIXES = new Set([
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

const STATIC_SERVICE_DETAIL_SEGMENTS = new Set([
  "chemical-x",
  "c-c-c-combo",
  "this-or-that",
  "transfigure",
  "history-course",
  "decisions-decisions",
  "pagestorm",
  "colorful-philosophers",
]);

const DEFRAGMENT_FEDERATED_SERVICES = new Set([
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
  "decisions_decisions",
  "favorite_tournament",
  "pagestorm",
  "history_course",
]);

const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function isRecordIdSegment(segment: string | undefined): boolean {
  return Boolean(segment && segment !== "__id__" && RECORD_ID_PATTERN.test(segment));
}

export function parseDetailShellTarget(pathname: string): DetailShellTarget | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  let gameLocale = "";
  let rest = parts;
  if (STATIC_GAME_LOCALE_PREFIXES.has(parts[0])) {
    gameLocale = parts[0];
    rest = parts.slice(1);
  }

  if (
    rest.length === 3 &&
    rest[0] === "defragment" &&
    DEFRAGMENT_FEDERATED_SERVICES.has(rest[1]) &&
    isRecordIdSegment(rest[2])
  ) {
    return {
      service: `defragment-${rest[1]}`,
      recordId: rest[2],
      gameLocale,
    };
  }

  if (
    rest.length === 2 &&
    rest[0] === "defragment" &&
    !DEFRAGMENT_FEDERATED_SERVICES.has(rest[1]) &&
    isRecordIdSegment(rest[1])
  ) {
    return {
      service: "defragment",
      recordId: rest[1],
      gameLocale,
    };
  }

  if (
    rest.length === 3 &&
    rest[0] === "this-or-that" &&
    rest[1] === "tournament" &&
    isRecordIdSegment(rest[2])
  ) {
    return {
      service: "this-or-that-tournament",
      recordId: rest[2],
      gameLocale,
    };
  }

  if (
    rest.length === 2 &&
    STATIC_SERVICE_DETAIL_SEGMENTS.has(rest[0]) &&
    isRecordIdSegment(rest[1])
  ) {
    return {
      service: rest[0],
      recordId: rest[1],
      gameLocale,
    };
  }

  return null;
}

/** The limit the PostgREST lookup had: a slower read serves the shell's list OG. */
const OG_LOOKUP_TIMEOUT_MS = 600;

/**
 * A record id as Postgres uuid input reads it (uuid_in: any case, a hyphen allowed after every four
 * hex digits), in the canonical lowercase form D1 stores. null where Postgres rejects the text: the
 * PostgREST lookup answered 400 there, which served no OG.
 */
function canonicalPostUuid(recordId: string): string | null {
  if (!/^(?:[0-9a-f]{4}-?){7}[0-9a-f]{4}$/i.test(recordId)) return null;
  const hex = recordId.replace(/-/g, "").toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The first row of one D1 read, or null on no row, an error or the time limit. */
async function readD1Row(db: D1Database, sql: string, ...params: unknown[]): Promise<Row | null> {
  try {
    const [rows] = await withTimeout(readAll(db, [query(sql, ...params)]), OG_LOOKUP_TIMEOUT_MS);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * `columns` of one Toy Box post as the Supabase row has them (postObject), JSON columns parsed: the
 * answer of the former `select=<columns>&id=eq.<id>&limit=1` PostgREST read. The D1 copy holds the
 * Worker's data env only, which the read filtered by.
 */
async function readPostColumns<T>(
  db: D1Database,
  service: FeedService,
  recordId: string,
  columns: readonly string[],
): Promise<T | null> {
  const id = canonicalPostUuid(recordId);
  if (!id) return null;
  const row = await readD1Row(db, postSql(service), id, service);
  if (!row) return null;
  try {
    // env is not among the columns read, so the data env passed here never shows.
    const post = postObject(service, row, "production");
    const out: Row = {};
    for (const name of columns) out[name] = materialize(post[name]);
    return out as T;
  } catch {
    return null;
  }
}

/** character and cover_spec of one History Course run (R5, the former `runs` read). */
async function readRunCover(
  db: D1Database,
  runId: string,
): Promise<{ character: string | null; cover_spec: unknown } | null> {
  const row = await readD1Row(db, Q_R5, runId);
  if (!row) return null;
  try {
    return { character: (row.character as string | null) ?? null, cover_spec: materialize(json(row.cover_spec)) };
  } catch {
    return null;
  }
}

function asPostBlocks(value: unknown): PostBlock[] {
  return Array.isArray(value) ? (value as PostBlock[]) : [];
}

function asComboResources(value: unknown): ComboResourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { type?: unknown; id?: unknown };
    if (typeof record.type !== "string" || typeof record.id !== "string") return [];
    if (!record.id.trim()) return [];
    return [{ type: record.type as ComboResourceRef["type"], id: record.id }];
  });
}

export async function fetchDetailShellOgData(
  target: DetailShellTarget,
  env: WorkerEnv,
  siteOrigin: string,
  pathname: string,
): Promise<DetailShellOgData | null> {
  const db = env.DETAIL_SHELL_OG === "d1" ? env.DB : undefined;
  if (!db) return null;

  // Same rule as the app: only the prefixless (kor) page is Korean, every
  // other game locale uses the en service copy.
  const serviceLocale = getServiceLocaleForGameLocale(getGameLocaleFromPathname(pathname));
  const brand = serviceLocale === "en" ? "Scare the Spire" : "슬서운 이야기";
  const game = serviceLocale === "en" ? "Slay the Spire 2" : "슬레이 더 스파이어 2";

  if (target.service === "history-course") {
    const row = await readRunCover(db, target.recordId);

    if (!row || !isCoverSpec(row.cover_spec)) return null;

    const cover = row.cover_spec;
    const runTitle = cover.titlePhrase?.trim() || cover.phrase.trim();
    if (!runTitle) return null;

    const landingTitle = serviceLocale === "en" ? "History Course" : "역사 강의서";
    const title = `${runTitle} - ${brand} ${landingTitle}`;
    const imageSource = coverOgImageFromFields({
      character: String(row.character ?? ""),
      coverSpec: cover,
    });
    const image = `${siteOrigin}${imageSource.url}`;
    const description =
      serviceLocale === "en"
        ? `${game} · ${brand} · History Course · Seeded run replay viewer and community runs.`
        : `${game} · ${brand} · 역사 강의서 · 시드 런 리플레이와 공유된 런 기록`;

    return { title, description, image };
  }

  if (target.service === "c-c-c-combo" || target.service === "defragment-combo") {
    const row = await readPostColumns<{
      content_text: string | null;
      content: unknown;
      resources: unknown;
    }>(db, "combo", target.recordId, ["content_text", "content", "resources"]);

    if (!row) return null;

    const rawTitle = truncateOgTitle(row.content_text || "");
    const fallbackServiceName = serviceLocale === "en" ? "C-c-c-Combo" : "코오오옴보";
    const title = rawTitle ? `${rawTitle} - ${brand}` : `${fallbackServiceName} - ${brand}`;
    const imageSource =
      comboPostOgImage({
        content: asPostBlocks(row.content),
        resources: asComboResources(row.resources),
      }) ?? COMBO_PAGE_OG_IMAGE;
    const image = `${siteOrigin}${imageSource.url}`;
    const description =
      serviceLocale === "en"
        ? `${game} · ${brand} · C-c-c-Combo · Share game-element combos`
        : `${game} · ${brand} · 코오오옴보 · 슬레이 더 스파이어 2 게임 요소 조합 공유하기`;

    return { title, description, image };
  }

  if (target.service === "chemical-x" || target.service === "defragment-chemical_x") {
    const row = await readPostColumns<{
      content_text: string | null;
      content: unknown;
    }>(db, "chemical_x", target.recordId, ["content_text", "content"]);

    if (!row) return null;

    const rawTitle = truncateOgTitle(row.content_text || "");
    const fallbackServiceName = serviceLocale === "en" ? "Chemical X" : "케미컬 X";
    const title = rawTitle ? `${rawTitle} - ${brand}` : `${fallbackServiceName} - ${brand}`;
    const imageSource = chemicalPostOgImage(asPostBlocks(row.content)) ?? CHEMICAL_X_PAGE_OG_IMAGE;
    const image = `${siteOrigin}${imageSource.url}`;
    const description =
      serviceLocale === "en"
        ? `${game} · ${brand} · Chemical X · Write a short post with game elements`
        : `${game} · ${brand} · 케미컬 X · 슬레이 더 스파이어 2 게임 요소로 짧은 글 쓰기`;

    return { title, description, image };
  }

  if (
    target.service === "this-or-that" ||
    target.service === "this-or-that-tournament" ||
    target.service === "defragment-this_or_that"
  ) {
    // The tournament route reads this_or_that too, as it read this_or_that_posts: a tournament id
    // (a favorite_tournament post) has no row there, so it gets no OG.
    const row = await readPostColumns<{
      reason: string | null;
      left_type: string | null;
      left_id: string | null;
    }>(db, "this_or_that", target.recordId, ["reason", "left_type", "left_id"]);

    if (!row) return null;

    const rawTitle = truncateOgTitle(row.reason || "");
    const fallbackServiceName = serviceLocale === "en" ? "This or That" : "이거 vs 저거";
    const title = rawTitle ? `${rawTitle} - ${brand}` : `${fallbackServiceName} - ${brand}`;
    const leftArt = row.left_type && row.left_id ? toyboxResourceOgImageUrl(row.left_type, row.left_id) : null;
    const image = leftArt ? `${siteOrigin}${leftArt}` : `${siteOrigin}${THIS_OR_THAT_PAGE_OG_IMAGE.url}`;
    const description =
      serviceLocale === "en"
        ? `${game} · ${brand} · This or That · Vote on game dilemmas`
        : `${game} · ${brand} · 이거 vs 저거 · 슬레이 더 스파이어 2 양자택일`;

    return { title, description, image };
  }

  if (target.service === "transfigure" || target.service === "defragment-transfigure") {
    const row = await readPostColumns<{
      title: string | null;
      transformed_name: string | null;
      resource_type: string | null;
      resource_id: string | null;
    }>(db, "transfigure", target.recordId, ["title", "transformed_name", "resource_type", "resource_id"]);

    if (!row) return null;

    const rawTitle = truncateOgTitle(row.transformed_name || row.title || "");
    const fallbackServiceName = serviceLocale === "en" ? "Transfigure" : "변형";
    const title = rawTitle ? `${rawTitle} - ${brand}` : `${fallbackServiceName} - ${brand}`;
    const resourceArt = row.resource_type && row.resource_id ? toyboxResourceOgImageUrl(row.resource_type, row.resource_id) : null;
    const image = resourceArt ? `${siteOrigin}${resourceArt}` : `${siteOrigin}/images/transfigure/og.png`;
    const description =
      serviceLocale === "en"
        ? `${game} · ${brand} · Transfigure · Rewrite game element text`
        : `${game} · ${brand} · 변형 · 슬레이 더 스파이어 2 게임 요소 설명 다시 쓰기`;

    return { title, description, image };
  }

  if (target.service === "pagestorm" || target.service === "defragment-pagestorm") {
    const row = await readPostColumns<{
      title: string | null;
      content_text: string | null;
      content: unknown;
    }>(db, "pagestorm", target.recordId, ["title", "content_text", "content"]);
    if (!row) return null;
    const rawTitle = truncateOgTitle(row.title || "");
    const fallbackServiceName = serviceLocale === "en" ? "Pagestorm" : "서류 폭풍";
    const title = rawTitle ? `${rawTitle} - ${brand}` : `${fallbackServiceName} - ${brand}`;
    const imageSource = row.content ? pagestormPostOgImage(row.content) : PAGESTORM_PAGE_OG_IMAGE;
    const image = imageSource.url.startsWith("http") ? imageSource.url : `${siteOrigin}${imageSource.url}`;
    const description = clipOgDescription(
      row.content_text || "",
      serviceLocale === "en"
        ? `${game} · ${brand} · Pagestorm · Write a document with game elements`
        : `${game} · ${brand} · 서류 폭풍 · 게임 요소로 문서 쓰기`,
    );
    return { title, description, image };
  }

  // defragment_posts never had a row and is not copied to D1 (D1_SCHEMA_DESIGN 7): no OG, without
  // a query, as the toybox-post adapter answers it.
  if (target.service === "defragment") return null;

  // The PostgREST read asked for decisions_posts, a table that does not exist, so it never served
  // OG (tasks/010 #69). Kept that way until that entry is fixed.
  if (target.service === "decisions-decisions" || target.service === "defragment-decisions_decisions") {
    return null;
  }

  return null;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Policy canonical for a record shell: ko and en are self-canonical, other game locales fold into /en. */
export function detailShellCanonicalUrl(siteOrigin: string, pathname: string): string {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  return `${siteOrigin}${searchCanonicalPath(normalizedPathname)}`;
}

/** Canonical, ko/en/x-default hreflang, and og:url tags for a record shell. */
export function detailShellSearchTagsHtml(canonicalUrl: string): string {
  const canonical = new URL(canonicalUrl);
  const href = escapeHtmlAttribute(canonical.toString());
  const alternates = Object.entries(searchLanguageAlternatePaths(canonical.pathname))
    .map(([hrefLang, alternatePath]) => (
      `<link rel="alternate" hreflang="${hrefLang}" href="${escapeHtmlAttribute(`${canonical.origin}${alternatePath}`)}"/>`
    ));
  return [
    `<link rel="canonical" href="${href}"/>`,
    ...alternates,
    `<meta property="og:url" content="${href}"/>`,
  ].join("");
}

/*
 * The prerendered ID shell carries no canonical, hreflang, or og:url (its RSC
 * payload has none either, so hydration adds none). Append exactly one set for
 * this record, computed from the path, whether or not the OG lookup succeeded.
 */
export function enrichShellHtml(
  response: Response,
  meta: DetailShellOgData | null,
  canonicalUrl: string,
): Response {
  let rewriter = new HTMLRewriter();
  if (meta) {
    rewriter = rewriter
      .on("title", {
        element(e) {
          e.setInnerContent(meta.title);
        },
      })
      .on('meta[property="og:title"]', {
        element(e) {
          e.setAttribute("content", meta.title);
        },
      })
      .on('meta[name="twitter:title"]', {
        element(e) {
          e.setAttribute("content", meta.title);
        },
      })
      .on('meta[name="description"]', {
        element(e) {
          e.setAttribute("content", meta.description);
        },
      })
      .on('meta[property="og:description"]', {
        element(e) {
          e.setAttribute("content", meta.description);
        },
      })
      .on('meta[name="twitter:description"]', {
        element(e) {
          e.setAttribute("content", meta.description);
        },
      })
      .on('meta[property="og:image"]', {
        element(e) {
          e.setAttribute("content", meta.image);
        },
      })
      .on('meta[name="twitter:image"]', {
        element(e) {
          e.setAttribute("content", meta.image);
        },
      });
  }

  const searchTags = detailShellSearchTagsHtml(canonicalUrl);
  return rewriter
    // Drop any search tags a stale shell still carries so exactly one set remains.
    .on('link[rel="canonical"]', {
      element(e) {
        e.remove();
      },
    })
    .on('link[rel="alternate"][hreflang]', {
      element(e) {
        e.remove();
      },
    })
    .on('meta[property="og:url"]', {
      element(e) {
        e.remove();
      },
    })
    .on("head", {
      element(e) {
        e.append(searchTags, { html: true });
      },
    })
    .transform(response);
}

export async function maybeEnrichServiceDetailShell(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContextLike,
  url: URL,
  baseResponse: Response,
): Promise<Response> {
  const target = parseDetailShellTarget(url.pathname);
  if (!target) return baseResponse;

  const cache =
    typeof caches !== "undefined" && "default" in caches
      ? (caches as unknown as { default: Cache }).default
      : null;
  const cacheKey = new Request(url.toString(), { method: "GET" });

  if (cache && (request.method === "GET" || request.method === "HEAD")) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const cachedRes = new Response(request.method === "HEAD" ? null : cached.body, cached);
        cachedRes.headers.set("x-cf-static-page", "shell");
        return cachedRes;
      }
    } catch {
      // cache lookup error: proceed to fresh generation
    }
  }

  const canonicalUrl = detailShellCanonicalUrl(url.origin, url.pathname);
  const ogData = await fetchDetailShellOgData(target, env, url.origin, url.pathname);
  const enriched = enrichShellHtml(baseResponse, ogData, canonicalUrl);
  // Cache only full enrichment so a failed lookup is retried on the next request.
  if (!ogData) return enriched;

  if (cache && request.method === "GET") {
    try {
      const toCache = enriched.clone();
      toCache.headers.set(
        "Cache-Control",
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      );
      ctx.waitUntil(cache.put(cacheKey, toCache));
    } catch {
      // cache put failure should not fail response
    }
  }

  return enriched;
}

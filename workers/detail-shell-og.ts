import {
  chemicalPostOgImage,
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

interface HTMLRewriterElement {
  setInnerContent(content: string, options?: { html?: boolean }): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
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
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_ENV?: string;
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
  url: string;
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
]);

const DEFRAGMENT_FEDERATED_SERVICES = new Set([
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
  "decisions_decisions",
  "favorite_tournament",
  "pagestorm",
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

function resolveSupabaseConfig(env: WorkerEnv) {
  const url = (
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    ""
  ).replace(/\/+$/, "");
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    "";
  const supabaseEnv =
    env.NEXT_PUBLIC_SUPABASE_ENV ||
    env.SUPABASE_ENV ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_ENV) ||
    "production";

  return {
    url,
    anonKey,
    env: supabaseEnv,
    enabled: Boolean(url && anonKey),
  };
}

async function fetchSupabaseRestSingleRow<T>(
  url: string,
  anonKey: string,
  table: string,
  select: string,
  recordId: string,
  envName: string,
): Promise<T | null> {
  const endpoint = `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(recordId)}&env=eq.${encodeURIComponent(envName)}&select=${encodeURIComponent(select)}&limit=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600);

  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const rows = (await res.json()) as T[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    clearTimeout(timeout);
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
  const config = resolveSupabaseConfig(env);
  if (!config.enabled) return null;

  const serviceLocale = target.gameLocale === "en" ? "en" : "ko";
  const brand = serviceLocale === "en" ? "Scare the Spire" : "슬서운 이야기";
  const game = serviceLocale === "en" ? "Slay the Spire 2" : "슬레이 더 스파이어 2";
  const canonicalUrl = `${siteOrigin}${pathname}`;

  if (target.service === "history-course") {
    const row = await fetchSupabaseRestSingleRow<{
      character: string | null;
      cover_spec: unknown;
    }>(config.url, config.anonKey, "runs", "character, cover_spec", target.recordId, config.env);

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

    return { title, description, image, url: canonicalUrl };
  }

  if (target.service === "c-c-c-combo" || target.service === "defragment-combo") {
    const row = await fetchSupabaseRestSingleRow<{
      content_text: string | null;
      content: unknown;
      resources: unknown;
    }>(config.url, config.anonKey, "combo_posts", "content_text, content, resources", target.recordId, config.env);

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

    return { title, description, image, url: canonicalUrl };
  }

  if (target.service === "chemical-x" || target.service === "defragment-chemical_x") {
    const row = await fetchSupabaseRestSingleRow<{
      content_text: string | null;
      content: unknown;
    }>(config.url, config.anonKey, "chemical_posts", "content_text, content", target.recordId, config.env);

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

    return { title, description, image, url: canonicalUrl };
  }

  if (
    target.service === "this-or-that" ||
    target.service === "this-or-that-tournament" ||
    target.service === "defragment-this_or_that"
  ) {
    const row = await fetchSupabaseRestSingleRow<{
      reason: string | null;
      left_type: string | null;
      left_id: string | null;
    }>(config.url, config.anonKey, "this_or_that_posts", "reason, left_type, left_id", target.recordId, config.env);

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

    return { title, description, image, url: canonicalUrl };
  }

  if (target.service === "transfigure" || target.service === "defragment-transfigure") {
    const row = await fetchSupabaseRestSingleRow<{
      title: string | null;
      transformed_name: string | null;
      resource_type: string | null;
      resource_id: string | null;
    }>(
      config.url,
      config.anonKey,
      "transfigure_posts",
      "title, transformed_name, resource_type, resource_id",
      target.recordId,
      config.env,
    );

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

    return { title, description, image, url: canonicalUrl };
  }

  if (target.service === "decisions-decisions" || target.service === "defragment-decisions_decisions") {
    const row = await fetchSupabaseRestSingleRow<{
      title: string | null;
      situation_character: string | null;
    }>(config.url, config.anonKey, "decisions_posts", "title, situation_character", target.recordId, config.env);

    if (!row) return null;

    const rawTitle = truncateOgTitle(row.title || "");
    const fallbackServiceName = serviceLocale === "en" ? "Decisions Decisions" : "어려운 결정";
    const title = rawTitle ? `${rawTitle} - ${brand}` : `${fallbackServiceName} - ${brand}`;
    const charSlug = (row.situation_character || "ironclad").replace(/^(CARD|CHARACTER|RELIC|POTION|POWER)\./i, "").toLowerCase();
    const image = `${siteOrigin}/images/sts2/characters/select_${charSlug}.webp`;
    const description =
      serviceLocale === "en"
        ? `${game} · ${brand} · Decisions Decisions · Strategic problem solving`
        : `${game} · ${brand} · 어려운 결정 · 슬레이 더 스파이어 2 상황 판단`;

    return { title, description, image, url: canonicalUrl };
  }

  return null;
}

export function enrichShellHtml(response: Response, meta: DetailShellOgData): Response {
  return new HTMLRewriter()
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
    })
    .on('meta[property="og:url"]', {
      element(e) {
        e.setAttribute("content", meta.url);
      },
    })
    .on('link[rel="canonical"]', {
      element(e) {
        e.setAttribute("href", meta.url);
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

  const ogData = await fetchDetailShellOgData(target, env, url.origin, url.pathname);
  if (!ogData) return baseResponse;

  const enriched = enrichShellHtml(baseResponse, ogData);

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

/**
 * Record shell OG (workers/detail-shell-og.ts): target parsing, search tags, the HTMLRewriter
 * registrations, and the OG lookup on a D1 stand-in (node:sqlite over d1/migrations, the SQL the
 * Worker runs). Off unless DETAIL_SHELL_OG=d1 and a DB binding are both present.
 *   pnpm exec tsx scripts/detail-shell-og.spec.ts
 */
import assert from "node:assert/strict";
import { pagestormPostOgImage } from "../src/lib/pagestorm";
import { clipOgDescription, postBlockOgImage } from "../src/lib/toybox-post-og";
import { DEFRAGMENT_PAGE_OG_IMAGE, THIS_OR_THAT_PAGE_OG_IMAGE } from "../src/lib/page-og-images";
import type { D1Database } from "../workers/api/d1";
import {
  detailShellCanonicalUrl,
  parseDetailShellTarget,
} from "../workers/detail-shell-og";
import { SqliteD1 } from "./d1-shadow/d1-shim";
import { openD1TestDb } from "./d1-sync/test-db";

// Default locale routes
const historyTarget = parseDetailShellTarget("/history-course/c167-20260901-abcd");
assert.deepEqual(historyTarget, {
  service: "history-course",
  recordId: "c167-20260901-abcd",
  gameLocale: "",
});

const comboTarget = parseDetailShellTarget("/c-c-c-combo/test-post-uuid");
assert.deepEqual(comboTarget, {
  service: "c-c-c-combo",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const chemicalTarget = parseDetailShellTarget("/chemical-x/test-post-uuid");
assert.deepEqual(chemicalTarget, {
  service: "chemical-x",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const thisOrThatTarget = parseDetailShellTarget("/this-or-that/test-post-uuid");
assert.deepEqual(thisOrThatTarget, {
  service: "this-or-that",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const transfigureTarget = parseDetailShellTarget("/transfigure/test-post-uuid");
assert.deepEqual(transfigureTarget, {
  service: "transfigure",
  recordId: "test-post-uuid",
  gameLocale: "",
});

assert.equal(pagestormPostOgImage({ type: "doc", content: [] }).url, "/images/sts2/cards/pagestorm.webp");
assert.equal(
  pagestormPostOgImage({
    type: "doc",
    content: [{ type: "gameAsset", attrs: { imageUrl: "/images/sts2/cards/bash.webp", kind: "card", name: "Bash" } }],
  }).url,
  "/images/sts2/cards/bash.webp",
);
assert.equal(clipOgDescription("", "fallback"), "fallback");
assert.equal(postBlockOgImage([], DEFRAGMENT_PAGE_OG_IMAGE).url, DEFRAGMENT_PAGE_OG_IMAGE.url);

const pagestormTarget = parseDetailShellTarget("/pagestorm/test-post-uuid");
assert.deepEqual(pagestormTarget, {
  service: "pagestorm",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const defragmentTarget = parseDetailShellTarget("/defragment/test-post-uuid");
assert.deepEqual(defragmentTarget, {
  service: "defragment",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const defragmentPagestorm = parseDetailShellTarget("/defragment/pagestorm/test-post-uuid");
assert.deepEqual(defragmentPagestorm, {
  service: "defragment-pagestorm",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const decisionsTarget = parseDetailShellTarget("/decisions-decisions/test-post-uuid");
assert.deepEqual(decisionsTarget, {
  service: "decisions-decisions",
  recordId: "test-post-uuid",
  gameLocale: "",
});

// English locale routes
const enHistoryTarget = parseDetailShellTarget("/en/history-course/c167-20260901-abcd");
assert.deepEqual(enHistoryTarget, {
  service: "history-course",
  recordId: "c167-20260901-abcd",
  gameLocale: "en",
});

const enComboTarget = parseDetailShellTarget("/en/c-c-c-combo/test-post-uuid");
assert.deepEqual(enComboTarget, {
  service: "c-c-c-combo",
  recordId: "test-post-uuid",
  gameLocale: "en",
});

// Federated defragment routes
const defragCombo = parseDetailShellTarget("/defragment/combo/test-post-uuid");
assert.deepEqual(defragCombo, {
  service: "defragment-combo",
  recordId: "test-post-uuid",
  gameLocale: "",
});

// Colorful Philosophers records are ID shells too, so they get record search tags.
assert.deepEqual(parseDetailShellTarget("/ja/colorful-philosophers/test-post-uuid"), {
  service: "colorful-philosophers",
  recordId: "test-post-uuid",
  gameLocale: "ja",
});

// Record canonical follows the search policy: ko and en are self-canonical,
// every other game locale folds into /en.
assert.equal(
  detailShellCanonicalUrl("https://example.test", "/this-or-that/abc"),
  "https://example.test/this-or-that/abc",
);
assert.equal(
  detailShellCanonicalUrl("https://example.test", "/en/this-or-that/abc/"),
  "https://example.test/en/this-or-that/abc",
);
assert.equal(
  detailShellCanonicalUrl("https://example.test", "/ja/this-or-that/abc"),
  "https://example.test/en/this-or-that/abc",
);
assert.equal(
  detailShellCanonicalUrl("https://example.test", "/es-419/defragment/combo/abc"),
  "https://example.test/en/defragment/combo/abc",
);

// Placeholder __id__ must return null
assert.equal(parseDetailShellTarget("/history-course/__id__"), null);
assert.equal(parseDetailShellTarget("/en/history-course/__id__"), null);
assert.equal(parseDetailShellTarget("/c-c-c-combo/__id__"), null);

// Non-shell routes must return null
assert.equal(parseDetailShellTarget("/history-course"), null);
assert.equal(parseDetailShellTarget("/compendium/cards/strike"), null);
assert.equal(parseDetailShellTarget("/patches/0.100.0"), null);

// Test enrichShellHtml handler registrations, attribute updates, and head output
interface MockElement {
  setInnerContent?(content: string): void;
  setAttribute?(name: string, value: string): void;
  getAttribute?(name: string): string | null;
  append?(content: string, options?: { html?: boolean }): void;
  remove?(): void;
}

let registeredSelectors: string[] = [];
let registeredHandlers = new Map<string, (el: MockElement) => void>();

function resetRewriterMock() {
  registeredSelectors = [];
  registeredHandlers = new Map();
}

function appendedHeadHtml(): string {
  let appended = "";
  registeredHandlers.get("head")?.({
    append(content: string, options?: { html?: boolean }) {
      assert.equal(options?.html, true);
      appended += content;
    },
  });
  return appended;
}

function assertRecordSearchTags(
  html: string,
  canonicalUrl: string,
  alternates: Record<string, string>,
) {
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"\/>/g)]
    .map((match) => match[1]);
  assert.deepEqual(canonicals, [canonicalUrl]);
  const hrefLangs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)]
    .map((match) => [match[1], match[2]]);
  assert.equal(hrefLangs.length, 3);
  assert.deepEqual(Object.fromEntries(hrefLangs), alternates);
  const ogUrls = [...html.matchAll(/<meta property="og:url" content="([^"]+)"\/>/g)]
    .map((match) => match[1]);
  assert.deepEqual(ogUrls, [canonicalUrl]);
}

function assertStaleSearchTagsRemoved() {
  for (const selector of [
    'link[rel="canonical"]',
    'link[rel="alternate"][hreflang]',
    'meta[property="og:url"]',
  ]) {
    let removed = false;
    registeredHandlers.get(selector)?.({
      remove() {
        removed = true;
      },
    });
    assert.ok(removed, selector);
  }
}

class TestHTMLRewriter {
  on(selector: string, handlers: { element?(el: MockElement): void }) {
    registeredSelectors.push(selector);
    if (handlers.element) {
      registeredHandlers.set(selector, handlers.element);
    }
    return this;
  }
  transform(response: Response) {
    return response;
  }
}

Object.assign(globalThis, { HTMLRewriter: TestHTMLRewriter });

// --- D1 fixture: one post per service, written as the sync writes them ---------------------------

const ORIGIN = "https://scare-the-spire.com";
const USER = "11111111-1111-4111-8111-111111111111";
const CREATED = "2026-11-01T00:00:00.123456Z";
const TOT = "4abc0001-0000-4000-8000-0000000000ef";
const TOT_UNKNOWN_SIDE = "40000002-0000-4000-8000-000000000002";
const COMBO = "20000001-0000-4000-8000-000000000001";
const CHEM = "10000001-0000-4000-8000-000000000001";
const TRANSFIGURE = "30000001-0000-4000-8000-000000000001";
const PAGESTORM = "70000001-0000-4000-8000-000000000001";
const TOURNAMENT = "50000001-0000-4000-8000-000000000001";
const DECISIONS = "60000001-0000-4000-8000-000000000001";
const RUN = "r0000000000000a01";
const MISSING = "00000000-0000-4000-8000-000000000000";

function seededD1(): SqliteD1 {
  const sqlite = openD1TestDb();
  const run = (sql: string, ...params: Array<string | number | null>) => sqlite.prepare(sql).run(...params);
  const post = (service: string, id: string, summary: string, title: string | null = null) =>
    run(
      "INSERT INTO posts (service, id, user_id, nickname, title, summary, created_at) VALUES (?, ?, ?, '철갑', ?, ?, ?)",
      service, id, USER, title, summary, CREATED,
    );

  post("this_or_that", TOT, "높이맞음?");
  run(
    "INSERT INTO post_this_or_that (post_id, left_type, left_id, right_type, right_id, reason) VALUES (?, 'card', 'bash', 'card', 'strike', '높이맞음?')",
    TOT,
  );
  // A side type with no art falls back to the list image, as a null side did in Supabase.
  post("this_or_that", TOT_UNKNOWN_SIDE, "높이맞음?");
  run(
    "INSERT INTO post_this_or_that (post_id, left_type, left_id, right_type, right_id, reason) VALUES (?, 'mystery', 'x', 'card', 'strike', '높이맞음?')",
    TOT_UNKNOWN_SIDE,
  );

  post("combo", COMBO, "강타와 닻 콤보");
  run("INSERT INTO post_combo (post_id, content, content_text) VALUES (?, '[{\"type\":\"text\",\"text\":\"본문\"}]', '강타와 닻 콤보')", COMBO);
  // Inserted out of order: resources come back in array (ord) order.
  run("INSERT INTO post_combo_resources (post_id, ord, resource_type, resource_id) VALUES (?, 1, 'card', 'bash')", COMBO);
  run("INSERT INTO post_combo_resources (post_id, ord, resource_type, resource_id) VALUES (?, 0, 'relic', 'anchor')", COMBO);

  post("chemical_x", CHEM, "닻 케미컬");
  run(
    "INSERT INTO post_chemical_x (post_id, content, content_text) VALUES (?, ?, '닻 케미컬')",
    CHEM,
    JSON.stringify([{ type: "text", text: "앞" }, { type: "keyword", entityType: "relic", entityId: "RELIC.ANCHOR", text: "닻" }]),
  );

  post("transfigure", TRANSFIGURE, "변형 제목", "변형 제목");
  run(
    "INSERT INTO post_transfigure (post_id, resource_type, resource_id, source_text, content, content_text, transformed_name) VALUES (?, 'card', 'bash', '원문', '[]', '변형된 강타', '강강타')",
    TRANSFIGURE,
  );

  post("pagestorm", PAGESTORM, "문서 제목", "문서 제목");
  run(
    "INSERT INTO post_pagestorm (post_id, content, content_text) VALUES (?, ?, '본문   내용')",
    PAGESTORM,
    JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }, { type: "gameAsset", attrs: { imageUrl: "/images/sts2/cards/bash.webp", kind: "card", name: "Bash" } }],
    }),
  );

  post("favorite_tournament", TOURNAMENT, "내 대회", "내 대회");
  run("INSERT INTO post_favorite_tournament (post_id, preset_key) VALUES (?, 'custom')", TOURNAMENT);

  post("history_course", RUN, "ALPHA");
  run(
    "INSERT INTO post_history_course (post_id, seed, build, \"character\", ascension, win, acts_count, cover_spec) VALUES (?, 'ALPHA', 'v0.107.1', 'CHARACTER.IRONCLAD', 7, 1, 3, ?)",
    RUN,
    JSON.stringify({
      background: { kind: "card-beta", cardId: "CARD.BASH" },
      phrase: "강타 런",
      titlePhrase: "50층 보스 격파!",
      elements: [],
      auto: false,
      suggestSeed: "ALPHA",
    }),
  );
  return new SqliteD1(sqlite);
}

const KO = { brand: "슬서운 이야기", game: "슬레이 더 스파이어 2" };
const EN = { brand: "Scare the Spire", game: "Slay the Spire 2" };

async function main() {
  const { enrichShellHtml, fetchDetailShellOgData, maybeEnrichServiceDetailShell } = await import("../workers/detail-shell-og");

  const dummyResponse = new Response("<html><head><title>old</title></head><body></body></html>", {
    headers: { "Content-Type": "text/html; charset=utf-8", "x-cf-static-page": "shell" },
  });

  const ogData = {
    title: "50층 보스 격파! - 슬서운 이야기 역사 강의서",
    description: "시드 런 리플레이",
    image: "https://scare-the-spire.com/images/sts2/cards/bash.webp",
  };
  const canonicalUrl = "https://scare-the-spire.com/history-course/my-run-123";
  const recordAlternates = {
    ko: "https://scare-the-spire.com/history-course/my-run-123",
    en: "https://scare-the-spire.com/en/history-course/my-run-123",
    "x-default": "https://scare-the-spire.com/en/history-course/my-run-123",
  };

  resetRewriterMock();
  const resultResponse = enrichShellHtml(dummyResponse, ogData, canonicalUrl);
  assert.equal(resultResponse.headers.get("x-cf-static-page"), "shell");

  // Verify all essential OG selectors were attached
  assert.ok(registeredSelectors.includes("title"));
  assert.ok(registeredSelectors.includes('meta[property="og:title"]'));
  assert.ok(registeredSelectors.includes('meta[name="twitter:title"]'));
  assert.ok(registeredSelectors.includes('meta[property="og:description"]'));
  assert.ok(registeredSelectors.includes('meta[name="twitter:description"]'));
  assert.ok(registeredSelectors.includes('meta[property="og:image"]'));
  assert.ok(registeredSelectors.includes('meta[name="twitter:image"]'));
  assert.ok(registeredSelectors.includes("head"));

  // Verify element mutations
  let titleContent = "";
  registeredHandlers.get("title")?.({
    setInnerContent(c: string) {
      titleContent = c;
    },
  });
  assert.equal(titleContent, ogData.title);

  let ogTitle = "";
  registeredHandlers.get('meta[property="og:title"]')?.({
    setAttribute(attr: string, val: string) {
      if (attr === "content") ogTitle = val;
    },
  });
  assert.equal(ogTitle, ogData.title);

  let ogImage = "";
  registeredHandlers.get('meta[property="og:image"]')?.({
    setAttribute(attr: string, val: string) {
      if (attr === "content") ogImage = val;
    },
  });
  assert.equal(ogImage, ogData.image);

  // Exactly one canonical, ko/en/x-default hreflang set, and og:url for the record.
  assertStaleSearchTagsRemoved();
  assertRecordSearchTags(appendedHeadHtml(), canonicalUrl, recordAlternates);

  // A failed OG lookup still gets the path-computed search tags, without an OG rewrite.
  resetRewriterMock();
  enrichShellHtml(new Response("<html><head></head></html>"), null, canonicalUrl);
  assert.ok(!registeredSelectors.includes("title"));
  assert.ok(!registeredSelectors.includes('meta[property="og:title"]'));
  assertStaleSearchTagsRemoved();
  assertRecordSearchTags(appendedHeadHtml(), canonicalUrl, recordAlternates);

  // A /ja record folds its canonical into /en and keeps reciprocal hreflang.
  resetRewriterMock();
  enrichShellHtml(
    new Response("<html><head></head></html>"),
    null,
    detailShellCanonicalUrl("https://scare-the-spire.com", "/ja/this-or-that/abc"),
  );
  assertRecordSearchTags(appendedHeadHtml(), "https://scare-the-spire.com/en/this-or-that/abc", {
    ko: "https://scare-the-spire.com/this-or-that/abc",
    en: "https://scare-the-spire.com/en/this-or-that/abc",
    "x-default": "https://scare-the-spire.com/en/this-or-that/abc",
  });

  const d1 = seededD1();
  const on = { DETAIL_SHELL_OG: "d1", DB: d1 };
  const lookup = async (pathname: string, env: Parameters<typeof fetchDetailShellOgData>[1] = on) => {
    const target = parseDetailShellTarget(pathname);
    assert.ok(target, pathname);
    return fetchDetailShellOgData(target, env, ORIGIN, pathname);
  };

  // Off unless DETAIL_SHELL_OG is exactly "d1" and DB is bound: no OG and no D1 read.
  for (const env of [{}, { DB: d1 }, { DETAIL_SHELL_OG: "on", DB: d1 }, { DETAIL_SHELL_OG: "D1", DB: d1 }, { DETAIL_SHELL_OG: "d1" }]) {
    assert.equal(await lookup(`/this-or-that/${TOT}`, env), null, JSON.stringify(Object.keys(env)));
  }
  assert.equal(d1.statements.length, 0);

  // OG copy follows the app's service locale: only the prefixless (kor) page is Korean.
  for (const [pathname, { brand, game }] of [
    [`/this-or-that/${TOT}`, KO],
    [`/en/this-or-that/${TOT}`, EN],
    [`/ja/this-or-that/${TOT}`, EN],
    [`/zh/this-or-that/${TOT}`, EN],
  ] as const) {
    const data = await lookup(pathname);
    assert.equal(data?.title, `높이맞음? - ${brand}`, pathname);
    assert.ok(data?.description.startsWith(`${game} · ${brand} · `), pathname);
  }

  // One record per service, the values the PostgREST lookup produced for the same rows.
  const koDescription = {
    thisOrThat: "슬레이 더 스파이어 2 · 슬서운 이야기 · 이거 vs 저거 · 슬레이 더 스파이어 2 양자택일",
    combo: "슬레이 더 스파이어 2 · 슬서운 이야기 · 코오오옴보 · 슬레이 더 스파이어 2 게임 요소 조합 공유하기",
    chemical: "슬레이 더 스파이어 2 · 슬서운 이야기 · 케미컬 X · 슬레이 더 스파이어 2 게임 요소로 짧은 글 쓰기",
    transfigure: "슬레이 더 스파이어 2 · 슬서운 이야기 · 변형 · 슬레이 더 스파이어 2 게임 요소 설명 다시 쓰기",
    history: "슬레이 더 스파이어 2 · 슬서운 이야기 · 역사 강의서 · 시드 런 리플레이와 공유된 런 기록",
  };
  const expected: Array<[string, { title: string; description: string; image: string }]> = [
    [`/this-or-that/${TOT}`, { title: "높이맞음? - 슬서운 이야기", description: koDescription.thisOrThat, image: `${ORIGIN}/images/sts2/cards/bash.webp` }],
    [`/this-or-that/${TOT_UNKNOWN_SIDE}`, { title: "높이맞음? - 슬서운 이야기", description: koDescription.thisOrThat, image: `${ORIGIN}${THIS_OR_THAT_PAGE_OG_IMAGE.url}` }],
    [`/defragment/this_or_that/${TOT}`, { title: "높이맞음? - 슬서운 이야기", description: koDescription.thisOrThat, image: `${ORIGIN}/images/sts2/cards/bash.webp` }],
    [`/c-c-c-combo/${COMBO}`, { title: "강타와 닻 콤보 - 슬서운 이야기", description: koDescription.combo, image: `${ORIGIN}/images/sts2/relics/anchor.webp` }],
    [`/defragment/combo/${COMBO}`, { title: "강타와 닻 콤보 - 슬서운 이야기", description: koDescription.combo, image: `${ORIGIN}/images/sts2/relics/anchor.webp` }],
    [`/chemical-x/${CHEM}`, { title: "닻 케미컬 - 슬서운 이야기", description: koDescription.chemical, image: `${ORIGIN}/images/sts2/relics/anchor.webp` }],
    [`/transfigure/${TRANSFIGURE}`, { title: "강강타 - 슬서운 이야기", description: koDescription.transfigure, image: `${ORIGIN}/images/sts2/cards/bash.webp` }],
    [`/pagestorm/${PAGESTORM}`, { title: "문서 제목 - 슬서운 이야기", description: "본문 내용", image: `${ORIGIN}/images/sts2/cards/bash.webp` }],
    [`/history-course/${RUN}`, { title: "50층 보스 격파! - 슬서운 이야기 역사 강의서", description: koDescription.history, image: `${ORIGIN}/images/sts2/cards/bash.webp` }],
    [`/en/history-course/${RUN}`, {
      title: "50층 보스 격파! - Scare the Spire History Course",
      description: "Slay the Spire 2 · Scare the Spire · History Course · Seeded run replay viewer and community runs.",
      image: `${ORIGIN}/images/sts2/cards/bash.webp`,
    }],
    // Postgres uuid input: any case, hyphens after any four hex digits or none.
    [`/this-or-that/${TOT.toUpperCase()}`, { title: "높이맞음? - 슬서운 이야기", description: koDescription.thisOrThat, image: `${ORIGIN}/images/sts2/cards/bash.webp` }],
    [`/c-c-c-combo/${COMBO.replace(/-/g, "")}`, { title: "강타와 닻 콤보 - 슬서운 이야기", description: koDescription.combo, image: `${ORIGIN}/images/sts2/relics/anchor.webp` }],
  ];
  for (const [pathname, value] of expected) {
    assert.deepEqual(await lookup(pathname), value, pathname);
  }

  // No row: a missing post, a run id in another case (runs.id is text), another service's id, and a
  // tournament id, which the lookup reads from this_or_that like before.
  for (const pathname of [
    `/this-or-that/${MISSING}`,
    `/history-course/${RUN.toUpperCase()}`,
    `/history-course/r-missing`,
    `/chemical-x/${COMBO}`,
    `/this-or-that/tournament/${TOURNAMENT}`,
  ]) {
    assert.equal(await lookup(pathname), null, pathname);
  }

  // Always null without a D1 read: not a uuid (PostgREST answered 400), defragment_posts (never had
  // a row), decisions_posts (no such table, tasks/010 #69), and services without a branch.
  const readsBefore = d1.statements.length;
  for (const pathname of [
    "/c-c-c-combo/test-post-uuid",
    `/defragment/${COMBO}`,
    `/decisions-decisions/${DECISIONS}`,
    `/defragment/decisions_decisions/${DECISIONS}`,
    `/colorful-philosophers/${COMBO}`,
    `/defragment/favorite_tournament/${TOURNAMENT}`,
    `/defragment/history_course/${RUN}`,
  ]) {
    assert.equal(await lookup(pathname), null, pathname);
  }
  assert.equal(d1.statements.length, readsBefore);

  // A failing or slow D1 serves no OG; the read keeps the 600 ms limit.
  const failing: D1Database = {
    prepare() {
      throw new Error("D1_ERROR: unavailable");
    },
    async batch() {
      throw new Error("D1_ERROR: unavailable");
    },
  };
  assert.equal(await lookup(`/this-or-that/${TOT}`, { DETAIL_SHELL_OG: "d1", DB: failing }), null);
  const hanging: D1Database = {
    prepare() {
      const statement = {
        bind: () => statement,
        all: () => new Promise<never>(() => {}),
        first: () => new Promise<never>(() => {}),
        run: () => new Promise<never>(() => {}),
      };
      return statement;
    },
    batch: () => new Promise<never>(() => {}),
  };
  const started = Date.now();
  assert.equal(await lookup(`/history-course/${RUN}`, { DETAIL_SHELL_OG: "d1", DB: hanging }), null);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 550 && elapsed < 2000, `lookup gave up after ${elapsed} ms`);

  // The shell response: off leaves the shell's OG alone and caches nothing; a found record is
  // rewritten and cached for an hour; a miss is not cached, so the next request retries.
  const puts: Response[] = [];
  Object.assign(globalThis, {
    caches: {
      default: {
        match: async () => undefined,
        put: async (_key: Request, value: Response) => {
          puts.push(value);
        },
      },
    },
  });
  const shellHtml = "<html><head><title>이거 아님 저거? - 슬서운 이야기</title></head><body></body></html>";
  const serve = async (pathname: string, env: Parameters<typeof maybeEnrichServiceDetailShell>[1]) => {
    const waits: Promise<unknown>[] = [];
    resetRewriterMock();
    const response = await maybeEnrichServiceDetailShell(
      new Request(`${ORIGIN}${pathname}`),
      env,
      { waitUntil: (promise) => waits.push(promise) },
      new URL(`${ORIGIN}${pathname}`),
      new Response(shellHtml, { headers: { "Content-Type": "text/html; charset=utf-8", "x-cf-static-page": "shell" } }),
    );
    await Promise.all(waits);
    return response;
  };
  try {
    const off = await serve(`/this-or-that/${TOT}`, { DB: d1 });
    assert.equal(await off.text(), shellHtml);
    assert.equal(off.headers.get("x-cf-static-page"), "shell");
    assert.ok(!registeredSelectors.includes("title"));
    assert.ok(!registeredSelectors.includes('meta[property="og:image"]'));
    assertStaleSearchTagsRemoved();
    assert.equal(puts.length, 0);

    await serve(`/this-or-that/${TOT}`, on);
    let title = "";
    registeredHandlers.get("title")?.({
      setInnerContent(content: string) {
        title = content;
      },
    });
    assert.equal(title, "높이맞음? - 슬서운 이야기");
    assert.equal(puts.length, 1);
    assert.equal(puts[0].headers.get("Cache-Control"), "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");

    await serve(`/this-or-that/${MISSING}`, on);
    assert.ok(!registeredSelectors.includes("title"));
    assert.equal(puts.length, 1);
  } finally {
    delete (globalThis as { caches?: unknown }).caches;
  }

  console.log("detail-shell-og.spec.ts ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

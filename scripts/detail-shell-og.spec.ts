import assert from "node:assert/strict";
import { pagestormPostOgImage } from "../src/lib/pagestorm";
import { clipOgDescription, postBlockOgImage } from "../src/lib/toybox-post-og";
import { DEFRAGMENT_PAGE_OG_IMAGE } from "../src/lib/page-og-images";
import {
  detailShellCanonicalUrl,
  parseDetailShellTarget,
} from "../workers/detail-shell-og";

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

async function main() {
  const { enrichShellHtml, fetchDetailShellOgData } = await import("../workers/detail-shell-og");

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

  // OG copy follows the app's service locale: only the prefixless (kor) page is Korean.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify([{ reason: "높이맞음?", left_type: null, left_id: null }]),
    { headers: { "Content-Type": "application/json" } },
  )) as typeof fetch;
  try {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://stub.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    };
    for (const [pathname, brand, game] of [
      ["/this-or-that/abc", "슬서운 이야기", "슬레이 더 스파이어 2"],
      ["/en/this-or-that/abc", "Scare the Spire", "Slay the Spire 2"],
      ["/ja/this-or-that/abc", "Scare the Spire", "Slay the Spire 2"],
      ["/zh/this-or-that/abc", "Scare the Spire", "Slay the Spire 2"],
    ] as const) {
      const target = parseDetailShellTarget(pathname);
      assert.ok(target, pathname);
      const data = await fetchDetailShellOgData(target, env, "https://scare-the-spire.com", pathname);
      assert.equal(data?.title, `높이맞음? - ${brand}`, pathname);
      assert.ok(data?.description.startsWith(`${game} · ${brand} · `), pathname);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("detail-shell-og.spec.ts ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

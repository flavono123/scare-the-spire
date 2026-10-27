import assert from "node:assert/strict";
import type { Metadata } from "next";
import {
  absoluteSearchCanonicalUrl,
  searchBasePath,
  searchCanonicalPath,
  searchLanguageAlternates,
  searchLocaleForPath,
  withSearchCanonical,
} from "../src/lib/search-canonical";
import { GAME_LOCALE_PATH_SEGMENTS } from "../src/lib/i18n";
import { isSearchCrawlerUserAgent } from "../src/lib/locale-detection";
import {
  getPatchDetailMetadata,
  getPatchSeoTitle,
  truncateOgDescription,
} from "../src/components/patches/patch-detail-page";
import { getSTS2Patches } from "../src/lib/data";
import { absoluteSiteUrl } from "../src/lib/site-origin";

// Locale-free base paths.
assert.equal(searchBasePath("/compendium/cards/strike"), "/compendium/cards/strike");
assert.equal(searchBasePath("/en/compendium/cards/strike"), "/compendium/cards/strike");
assert.equal(searchBasePath("/zh/patches/0.107.1"), "/patches/0.107.1");
assert.equal(searchBasePath("/codex/relics/anchor"), "/compendium/relics/anchor");
assert.equal(searchBasePath("/en"), "/");
assert.equal(searchBasePath("/patches?x=1#top"), "/patches");

// ko (prefixless) and en are self-canonical.
assert.equal(searchLocaleForPath("/"), "ko");
assert.equal(searchLocaleForPath("/patches/0.111.0"), "ko");
assert.equal(searchLocaleForPath("/en/patches/0.111.0"), "en");
assert.equal(searchCanonicalPath("/"), "/");
assert.equal(searchCanonicalPath("/en"), "/en");
assert.equal(searchCanonicalPath("/patches"), "/patches");
assert.equal(searchCanonicalPath("/en/patches"), "/en/patches");
assert.equal(searchCanonicalPath("/compendium/cards/bash"), "/compendium/cards/bash");
assert.equal(searchCanonicalPath("/en/compendium/cards/bash"), "/en/compendium/cards/bash");
assert.equal(searchCanonicalPath("/codex/relics/anchor", "en"), "/en/compendium/relics/anchor");

// Every other game-locale prefix canonicalizes to its /en counterpart.
for (const segment of GAME_LOCALE_PATH_SEGMENTS) {
  assert.equal(searchLocaleForPath(`/${segment}/patches`), "en", segment);
  assert.equal(searchCanonicalPath(`/${segment}`), "/en", segment);
  assert.equal(searchCanonicalPath(`/${segment}/patches/0.111.0`), "/en/patches/0.111.0", segment);
  assert.equal(
    searchCanonicalPath(`/${segment}/compendium/powers/painful_stabs`),
    "/en/compendium/powers/painful_stabs",
    segment,
  );
}
assert.match(
  absoluteSearchCanonicalUrl("/ja/compendium/powers/painful_stabs"),
  /\/en\/compendium\/powers\/painful_stabs$/,
);

// Locale-free metadata paths pick the variant from the service locale.
assert.equal(searchCanonicalPath("/patches", "ko"), "/patches");
assert.equal(searchCanonicalPath("/patches", "en"), "/en/patches");
assert.equal(searchCanonicalPath("/", "en"), "/en");

// ko/en/x-default alternates are identical (reciprocal) on every variant.
const patchAlternates = {
  ko: absoluteSiteUrl("/patches/0.111.0"),
  en: absoluteSiteUrl("/en/patches/0.111.0"),
  "x-default": absoluteSiteUrl("/en/patches/0.111.0"),
};
for (const path of ["/patches/0.111.0", "/en/patches/0.111.0", "/ja/patches/0.111.0", "/es-419/patches/0.111.0"]) {
  assert.deepEqual(searchLanguageAlternates(path), patchAlternates, path);
}
assert.deepEqual(searchLanguageAlternates("/en"), {
  ko: absoluteSiteUrl("/"),
  en: absoluteSiteUrl("/en"),
  "x-default": absoluteSiteUrl("/en"),
});

// Next metadata: canonical, og:url, and hreflang alternates.
const base: Metadata = {
  title: "Bash",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
  openGraph: { title: "Bash" },
};
const koMetadata = withSearchCanonical(base, "/compendium/cards/bash", "ko");
const enMetadata = withSearchCanonical(base, "/compendium/cards/bash", "en");
assert.equal(koMetadata.alternates?.canonical, absoluteSiteUrl("/compendium/cards/bash"));
assert.equal(enMetadata.alternates?.canonical, absoluteSiteUrl("/en/compendium/cards/bash"));
assert.equal((koMetadata.openGraph as { url?: string }).url, absoluteSiteUrl("/compendium/cards/bash"));
assert.equal((enMetadata.openGraph as { url?: string }).url, absoluteSiteUrl("/en/compendium/cards/bash"));
assert.deepEqual(koMetadata.alternates?.languages, enMetadata.alternates?.languages);
assert.deepEqual(koMetadata.alternates?.types, base.alternates?.types);
assert.equal(withSearchCanonical({ title: "x" }, "/patches", "en").openGraph, undefined);

// Crawlers keep the requested language page (no client locale switch), so the
// rendered canonical stays on that page. HeadlessChrome alone is not a crawler.
for (const userAgent of [
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.137 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)",
  "Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html?faqId=28966)",
  "Mozilla/5.0 (compatible; MSIE or Firefox mutant; not on Windows server; + http://tab.search.daum.net/aboutWebSearch.html) Daumoa/3.0",
  "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
  "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
  "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
  "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
  "Example-Crawler/1.0",
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
  "Mediapartners-Google",
]) {
  assert.equal(isSearchCrawlerUserAgent(userAgent), true, userAgent);
}
for (const userAgent of [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/145.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36 DaumApps/7.10.0 DaumDevice/mobile",
  "",
  undefined,
]) {
  assert.equal(isSearchCrawlerUserAgent(userAgent), false, String(userAgent));
}

// Clipped patch descriptions end at a word boundary (ko words are space-separated too).
assert.equal(truncateOgDescription("alpha beta gamma", 12), "alpha beta…");
assert.equal(truncateOgDescription("alpha beta gamma", 11), "alpha beta…");
assert.equal(truncateOgDescription("alpha, beta gamma", 9), "alpha…");
assert.equal(truncateOgDescription("가나 다라마 바사", 8), "가나 다라마…");
assert.equal(truncateOgDescription("alpha beta", 10), "alpha beta");

// Every patch detail description keeps the SEO title prefix and never stops mid-word.
async function checkPatchDetailDescriptions() {
  const patches = await getSTS2Patches();
  for (const serviceLocale of ["ko", "en"] as const) {
    for (const patch of patches) {
      const label = `${serviceLocale} ${patch.version}`;
      const metadata = await getPatchDetailMetadata({ version: patch.version, serviceLocale });
      const description = String(metadata.description ?? "");
      const title = getPatchSeoTitle(patch, serviceLocale);
      const full = `${title}. ${serviceLocale === "ko" ? patch.summaryKo : patch.summary}`;
      assert.ok(description.startsWith(title), label);
      assert.ok(description.length <= 200, label);
      if (!description.endsWith("…")) {
        assert.equal(description, full, label);
        continue;
      }
      const body = description.slice(0, -1);
      assert.ok(full.startsWith(body), label);
      assert.ok(
        !/[\p{L}\p{N}]$/u.test(body) || !/[\p{L}\p{N}]/u.test(full[body.length] ?? ""),
        `${label} clipped mid-word: ${description}`,
      );
    }
  }
}

checkPatchDetailDescriptions().then(
  () => console.log("search-canonical ok"),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);

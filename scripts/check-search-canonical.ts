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

console.log("search-canonical ok");

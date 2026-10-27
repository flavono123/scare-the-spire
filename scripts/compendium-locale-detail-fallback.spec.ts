import assert from "node:assert/strict";
import { getGameOnlyCompendiumDetailFallbackHref } from "../src/lib/compendium-resource-links";
import {
  GAME_LOCALES,
  getServiceLocaleForGameLocale,
  pathPrefixForGameLocale,
  switchGameLocaleHref,
  withGameLocaleSearch,
  type GameLocale,
} from "../src/lib/i18n";

// Mirrors languageHref in src/components/site-navbar.tsx, which the language
// menu, InitialLocaleDetector and LocaleCanonicalizer all use.
function languageHref(href: string, gameLocale: GameLocale): string {
  const url = new URL(href, "https://spec.invalid");
  const search = withGameLocaleSearch(
    url.searchParams,
    gameLocale,
    getServiceLocaleForGameLocale(gameLocale),
  );
  const switched = switchGameLocaleHref(url.pathname, gameLocale, search);
  return getGameOnlyCompendiumDetailFallbackHref(switched) ?? switched;
}

const DIRECT_DETAIL_LOCALES: GameLocale[] = ["kor", "eng"];
const GAME_ONLY_LOCALES = GAME_LOCALES.filter((locale) => !DIRECT_DETAIL_LOCALES.includes(locale));
assert.equal(GAME_ONLY_LOCALES.length, 12);

// Every STS2 detail route and the list modal URL it opens on a game-only locale.
const STS2_DETAILS = [
  { detail: "/compendium/ancients/darv", list: "/compendium/ancients?ancient=darv" },
  { detail: "/compendium/ascensions/level_00", list: "/compendium/ascensions?ascension=level_00" },
  { detail: "/compendium/badges/big_deck", list: "/compendium/badges?badge=big_deck" },
  { detail: "/compendium/cards/bash", list: "/compendium/cards?card=bash" },
  { detail: "/compendium/characters/ironclad", list: "/compendium/characters?character=ironclad" },
  { detail: "/compendium/enchantments/adroit", list: "/compendium/enchantments?enchantment=adroit" },
  // Afflictions share the enchantment detail route and list.
  { detail: "/compendium/enchantments/bound", list: "/compendium/enchantments?enchantment=bound" },
  { detail: "/compendium/encounters/aeonglass_boss", list: "/compendium/bestiary?view=encounters&encounter=aeonglass_boss" },
  { detail: "/compendium/epochs/colorless1_epoch", list: "/compendium/epochs?epoch=colorless1_epoch" },
  { detail: "/compendium/events/dense_vegetation", list: "/compendium/events?event=dense_vegetation" },
  { detail: "/compendium/keywords/eternal", list: "/compendium/keywords?keyword=eternal" },
  { detail: "/compendium/modifiers/draft", list: "/compendium/modifiers?modifier=draft" },
  { detail: "/compendium/monsters/doormaker", list: "/compendium/bestiary?monster=doormaker" },
  { detail: "/compendium/potions/ambergris", list: "/compendium/potions?potion=ambergris" },
  { detail: "/compendium/powers/accelerant", list: "/compendium/powers?power=accelerant" },
  { detail: "/compendium/relics/akabeko", list: "/compendium/relics?relic=akabeko" },
];

// STS1 lists open an entry with ?card=/?potion=/?power=/?relic=; the
// character select has no such param.
const STS1_DETAILS = [
  { detail: "/compendium/sts1/cards/anger", list: "/compendium/sts1/cards?card=anger" },
  { detail: "/compendium/sts1/characters/silent", list: "/compendium/sts1/characters" },
  { detail: "/compendium/sts1/potions/regen-potion", list: "/compendium/sts1/potions?potion=regen-potion" },
  { detail: "/compendium/sts1/powers/after-image", list: "/compendium/sts1/powers?power=after-image" },
  { detail: "/compendium/sts1/relics/akabeko", list: "/compendium/sts1/relics?relic=akabeko" },
];

for (const { detail, list } of [...STS2_DETAILS, ...STS1_DETAILS]) {
  for (const source of [detail, `/en${detail}`, `/ja${detail}`]) {
    for (const locale of GAME_ONLY_LOCALES) {
      const prefix = pathPrefixForGameLocale(locale);
      assert.equal(languageHref(source, locale), `${prefix}${list}`, `${source} -> ${locale}`);
    }
    // ko and en keep the detail page.
    assert.equal(languageHref(source, "kor"), detail, `${source} -> kor`);
    assert.equal(languageHref(source, "eng"), `/en${detail}`, `${source} -> eng`);
  }
}

// Legacy /codex paths and trailing slashes are detail paths too.
assert.equal(languageHref("/codex/cards/bash", "jpn"), "/ja/compendium/cards?card=bash");
assert.equal(languageHref("/compendium/cards/bash/", "deu"), "/de/compendium/cards?card=bash");
// Upper-case ids are lowered like every other modal URL.
assert.equal(languageHref("/compendium/cards/BASH", "zhs"), "/zh/compendium/cards?card=bash");

// ?version= and &beta= survive like updateCompendiumResourceModalUrl keeps them.
assert.equal(
  languageHref("/compendium/cards/bash?version=0.110.0&beta=true", "jpn"),
  "/ja/compendium/cards?version=0.110.0&beta=true&card=bash",
);
assert.equal(
  languageHref("/en/compendium/encounters/aeonglass_boss?version=0.110.0", "fra"),
  "/fr/compendium/bestiary?version=0.110.0&view=encounters&encounter=aeonglass_boss",
);
assert.equal(
  languageHref("/compendium/cards/bash?version=0.110.0&beta=true", "eng"),
  "/en/compendium/cards/bash?version=0.110.0&beta=true",
);
// The legacy gl param is dropped before the fallback.
assert.equal(languageHref("/compendium/cards/bash?gl=jpn", "jpn"), "/ja/compendium/cards?card=bash");

// Lists, the Compendium index and non-Compendium pages are left alone.
for (const href of [
  "/ja/compendium",
  "/ja/compendium/cards",
  "/ja/compendium/cards?card=bash",
  "/ja/compendium/bestiary?monster=doormaker",
  "/ja/compendium/sts1/cards",
  "/ja/compendium/sts1/cards?card=anger",
  "/ja/patches/0.105.1",
  "/ja",
  "/compendium/cards/bash",
  "/en/compendium/cards/bash",
  "/en/compendium/sts1/cards/anger",
  // Not a detail route: unknown STS1 list and nested segments.
  "/ja/compendium/sts1/unknown/anger",
  "/ja/compendium/cards/bash/extra",
]) {
  assert.equal(getGameOnlyCompendiumDetailFallbackHref(href), null, href);
}
assert.equal(languageHref("/compendium/cards", "jpn"), "/ja/compendium/cards");
assert.equal(languageHref("/patches/0.105.1", "deu"), "/de/patches/0.105.1");

console.log("compendium-locale-detail-fallback ok");

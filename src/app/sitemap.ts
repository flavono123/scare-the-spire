import type { MetadataRoute } from "next";
import {
  generateAncientStaticParams,
  generateCardStaticParams,
  generateCharacterStaticParams,
  generateEnchantmentStaticParams,
  generateEncounterStaticParams,
  generateEpochStaticParams,
  generateEventStaticParams,
  generateKeywordStaticParams,
  generateModifierStaticParams,
  generateAscensionStaticParams,
  generateBlitzEntryStaticParams,
  generateDominionStaticParams,
  generatePetStaticParams,
  generateMonsterStaticParams,
  generatePotionStaticParams,
  generatePowerStaticParams,
  generateRelicStaticParams,
} from "@/lib/codex-static-params";
import { getSTS2Patches } from "@/lib/data";
import { getNeowsletters } from "@/lib/neowsletters";
import { getActiveRunBadgeCatalog } from "@/lib/run-badge-catalog";
import {
  generateSts1BlightsStaticParams,
  generateSts1EventsStaticParams,
  generateSts1KeywordsStaticParams,
  generateSts1ModifiersStaticParams,
} from "@/lib/sts1/static-params";
import { searchLanguageAlternates } from "@/lib/search-canonical";
import {
  getSts1Cards,
  getSts1Characters,
  getSts1Monsters,
  getSts1Potions,
  getSts1Powers,
  getSts1Relics,
} from "@/lib/sts1/data";

export const dynamic = "force-static";

const PUBLIC_INDEX_PATHS = [
  "/",
  "/byrdispatch",
  "/c-c-c-combo",
  "/chemical-x",
  "/defragment",
  "/history-course",
  "/patches",
  "/patches/changes",
  "/patches/neowsletters",
  "/this-or-that",
  "/this-or-that/tournament",
  "/transfigure",
  "/decisions-decisions",
  "/pagestorm",
  "/colorful-philosophers",
  "/vexing-puzzlebox",
  "/vexing-puzzlebox/beta-art",
] as const;

const COMPENDIUM_INDEX_PATHS = [
  "/compendium",
  "/compendium/ancients",
  "/compendium/badges",
  "/compendium/bestiary",
  "/compendium/cards",
  "/compendium/characters",
  "/compendium/enchantments",
  "/compendium/epochs",
  "/compendium/events",
  "/compendium/keywords",
  "/compendium/modifiers",
  "/compendium/ascensions",
  "/compendium/blitz-shop",
  "/compendium/dominions",
  "/compendium/pets",
  "/compendium/potions",
  "/compendium/powers",
  "/compendium/relics",
  "/compendium/sts1/characters",
  "/compendium/sts1/cards",
  "/compendium/sts1/relics",
  "/compendium/sts1/potions",
  "/compendium/sts1/powers",
  "/compendium/sts1/monsters",
  "/compendium/sts1/events",
  "/compendium/sts1/keywords",
  "/compendium/sts1/ascensions",
  "/compendium/sts1/modifiers",
  "/compendium/sts1/blights",
  "/compendium/sts1/neow",
  "/compendium/sts1/achievements",
  "/compendium/sts1/score-bonuses",
] as const;

const COMPENDIUM_DETAIL_ROUTES = [
  ["ancients", generateAncientStaticParams],
  ["badges", async () => (await getActiveRunBadgeCatalog("eng")).map(({ slug }) => ({ id: slug }))],
  ["cards", generateCardStaticParams],
  ["characters", generateCharacterStaticParams],
  ["enchantments", generateEnchantmentStaticParams],
  ["encounters", generateEncounterStaticParams],
  ["epochs", generateEpochStaticParams],
  ["events", generateEventStaticParams],
  ["keywords", generateKeywordStaticParams],
  ["modifiers", generateModifierStaticParams],
  ["ascensions", generateAscensionStaticParams],
  ["blitz-shop", generateBlitzEntryStaticParams],
  ["dominions", generateDominionStaticParams],
  ["pets", generatePetStaticParams],
  ["monsters", generateMonsterStaticParams],
  ["potions", generatePotionStaticParams],
  ["powers", generatePowerStaticParams],
  ["relics", generateRelicStaticParams],
] as const;

const SEARCH_INDEXED_LOCALES = ["ko", "en"] as const;

/** One entry per indexable language, each listing the reciprocal ko/en/x-default alternates. */
function localizedEntries(path: string, lastModified?: string): MetadataRoute.Sitemap {
  const languages = searchLanguageAlternates(path);
  return SEARCH_INDEXED_LOCALES.map((locale) => ({
    url: languages[locale],
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }));
}

/** Announced dates can be ahead of the build; a sitemap must not claim a future edit. */
function lastModifiedNoLaterThan(date: string, buildDate: string): string {
  return date.slice(0, 10) > buildDate ? buildDate : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    detailParamGroups,
    patches,
    neowsletters,
    sts1Cards,
    sts1Relics,
    sts1Potions,
    sts1Powers,
    sts1Monsters,
    sts1Characters,
    sts1Extras,
  ] = await Promise.all([
    Promise.all(
      COMPENDIUM_DETAIL_ROUTES.map(([, generateParams]) => generateParams()),
    ),
    getSTS2Patches(),
    getNeowsletters(),
    getSts1Cards(),
    getSts1Relics(),
    getSts1Potions(),
    getSts1Powers(),
    getSts1Monsters(),
    getSts1Characters(),
    Promise.all([
      generateSts1EventsStaticParams(),
      generateSts1KeywordsStaticParams(),
      generateSts1ModifiersStaticParams(),
      generateSts1BlightsStaticParams(),
    ]),
  ]);
  const paths = [
    ...PUBLIC_INDEX_PATHS,
    ...COMPENDIUM_INDEX_PATHS,
    ...detailParamGroups.flatMap((params, index) => {
      const [segment] = COMPENDIUM_DETAIL_ROUTES[index];
      return params.map(({ id }) => `/compendium/${segment}/${id}`);
    }),
    ...sts1Cards.map((card) => `/compendium/sts1/cards/${card.slug}`),
    ...sts1Relics.map((relic) => `/compendium/sts1/relics/${relic.slug}`),
    ...sts1Potions.map((potion) => `/compendium/sts1/potions/${potion.slug}`),
    ...sts1Powers.map((power) => `/compendium/sts1/powers/${power.slug}`),
    ...sts1Monsters.map((monster) => `/compendium/sts1/monsters/${monster.slug}`),
    ...sts1Characters.map((character) => `/compendium/sts1/characters/${character.slug}`),
    ...(["events", "keywords", "modifiers", "blights"] as const).flatMap((type, index) => (
      sts1Extras[index].map(({ id }) => `/compendium/sts1/${type}/${id}`)
    )),
  ];
  const buildDate = new Date().toISOString().slice(0, 10);
  const lastModified = (date: string) => lastModifiedNoLaterThan(date, buildDate);
  const latestPatchDate = patches.map(({ date }) => lastModified(date)).sort().at(-1);
  const latestNeowsletterDate = neowsletters.map(({ date }) => lastModified(date)).sort().at(-1);

  return [
    ...paths.flatMap((path) => localizedEntries(
      path,
      path === "/patches" || path === "/patches/changes"
        ? latestPatchDate
        : path === "/patches/neowsletters"
          ? latestNeowsletterDate
          : undefined,
    )),
    ...patches.flatMap(({ version, date }) => localizedEntries(`/patches/${version}`, lastModified(date))),
    ...neowsletters.flatMap(({ id, date }) => localizedEntries(`/patches/neowsletters/${id}`, lastModified(date))),
  ];
}

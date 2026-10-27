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
  generateMonsterStaticParams,
  generatePotionStaticParams,
  generatePowerStaticParams,
  generateRelicStaticParams,
} from "@/lib/codex-static-params";
import { getSTS2Patches } from "@/lib/data";
import { getNeowsletters } from "@/lib/neowsletters";
import { getActiveRunBadgeCatalog } from "@/lib/run-badge-catalog";
import { searchLanguageAlternates } from "@/lib/search-canonical";
import {
  getSts1Cards,
  getSts1Characters,
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
  "/compendium/potions",
  "/compendium/powers",
  "/compendium/relics",
  "/compendium/sts1/characters",
  "/compendium/sts1/cards",
  "/compendium/sts1/relics",
  "/compendium/sts1/potions",
  "/compendium/sts1/powers",
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    detailParamGroups,
    patches,
    neowsletters,
    sts1Cards,
    sts1Relics,
    sts1Potions,
    sts1Powers,
    sts1Characters,
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
    getSts1Characters(),
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
    ...sts1Characters.map((character) => `/compendium/sts1/characters/${character.slug}`),
  ];
  const latestPatchDate = patches.map(({ date }) => date).sort().at(-1);
  const latestNeowsletterDate = neowsletters.map(({ date }) => date).sort().at(-1);

  return [
    ...paths.flatMap((path) => localizedEntries(
      path,
      path === "/patches" || path === "/patches/changes"
        ? latestPatchDate
        : path === "/patches/neowsletters"
          ? latestNeowsletterDate
          : undefined,
    )),
    ...patches.flatMap(({ version, date }) => localizedEntries(`/patches/${version}`, date)),
    ...neowsletters.flatMap(({ id, date }) => localizedEntries(`/patches/neowsletters/${id}`, date)),
  ];
}

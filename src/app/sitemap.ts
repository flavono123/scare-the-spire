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
import { getActiveRunBadgeCatalog } from "@/lib/run-badge-catalog";
import { absoluteSiteUrl } from "@/lib/site-origin";
import {
  getSts1Cards,
  getSts1Potions,
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
  "/this-or-that",
  "/this-or-that/tournament",
  "/transfigure",
  "/decisions-decisions",
  "/pagestorm",
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
  "/compendium/sts1/cards",
  "/compendium/sts1/relics",
  "/compendium/sts1/potions",
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [detailParamGroups, patches, sts1Cards, sts1Relics, sts1Potions] = await Promise.all([
    Promise.all(
      COMPENDIUM_DETAIL_ROUTES.map(([, generateParams]) => generateParams()),
    ),
    getSTS2Patches(),
    getSts1Cards(),
    getSts1Relics(),
    getSts1Potions(),
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
  ];
  const latestPatchDate = patches.map(({ date }) => date).sort().at(-1);

  return [
    ...paths.map((path) => ({
      url: absoluteSiteUrl(path),
      ...((path === "/patches" || path === "/patches/changes") && latestPatchDate
        ? { lastModified: latestPatchDate }
        : {}),
    })),
    ...patches.map(({ version, date }) => ({
      url: absoluteSiteUrl(`/patches/${version}`),
      lastModified: date,
    })),
  ];
}

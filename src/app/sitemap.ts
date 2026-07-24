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
  generateMonsterStaticParams,
  generatePotionStaticParams,
  generatePowerStaticParams,
  generateRelicStaticParams,
} from "@/lib/codex-static-params";
import { getCards, getPotions, getRelics, getSTS2Patches } from "@/lib/data";
import { absoluteSiteUrl } from "@/lib/site-origin";

export const dynamic = "force-static";

const PUBLIC_INDEX_PATHS = [
  "/",
  "/byrdispatch",
  "/cards",
  "/c-c-c-combo",
  "/chemical-x",
  "/history-course",
  "/patches",
  "/potions",
  "/relics",
  "/this-or-that",
] as const;

const COMPENDIUM_INDEX_PATHS = [
  "/compendium",
  "/compendium/ancients",
  "/compendium/bestiary",
  "/compendium/cards",
  "/compendium/characters",
  "/compendium/enchantments",
  "/compendium/epochs",
  "/compendium/events",
  "/compendium/keywords",
  "/compendium/potions",
  "/compendium/powers",
  "/compendium/relics",
] as const;

const COMPENDIUM_DETAIL_ROUTES = [
  ["ancients", generateAncientStaticParams],
  ["cards", generateCardStaticParams],
  ["characters", generateCharacterStaticParams],
  ["enchantments", generateEnchantmentStaticParams],
  ["encounters", generateEncounterStaticParams],
  ["epochs", generateEpochStaticParams],
  ["events", generateEventStaticParams],
  ["keywords", generateKeywordStaticParams],
  ["monsters", generateMonsterStaticParams],
  ["potions", generatePotionStaticParams],
  ["powers", generatePowerStaticParams],
  ["relics", generateRelicStaticParams],
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [detailParamGroups, patches, cards, relics, potions] = await Promise.all([
    Promise.all(
      COMPENDIUM_DETAIL_ROUTES.map(([, generateParams]) => generateParams()),
    ),
    getSTS2Patches(),
    getCards(),
    getRelics(),
    getPotions(),
  ]);
  const paths = [
    ...PUBLIC_INDEX_PATHS,
    ...COMPENDIUM_INDEX_PATHS,
    ...detailParamGroups.flatMap((params, index) => {
      const [segment] = COMPENDIUM_DETAIL_ROUTES[index];
      return params.map(({ id }) => `/compendium/${segment}/${id}`);
    }),
    ...patches.map(({ version }) => `/patches/${version}`),
    ...cards.map(({ id }) => `/cards/${id}`),
    ...relics.map(({ id }) => `/relics/${id}`),
    ...potions.map(({ id }) => `/potions/${id}`),
  ];

  return paths.map((path) => ({ url: absoluteSiteUrl(path) }));
}

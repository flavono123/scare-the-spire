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
import { absoluteSiteUrl } from "@/lib/site-origin";

export const dynamic = "force-static";

const COMPENDIUM_INDEX_PATHS = [
  "/compendium",
  "/compendium/ancients",
  "/compendium/bestiary",
  "/compendium/cards",
  "/compendium/characters",
  "/compendium/enchantments",
  "/compendium/encounters",
  "/compendium/epochs",
  "/compendium/events",
  "/compendium/keywords",
  "/compendium/monsters",
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
  const detailParamGroups = await Promise.all(
    COMPENDIUM_DETAIL_ROUTES.map(([, generateParams]) => generateParams()),
  );
  const paths = [
    "/",
    ...COMPENDIUM_INDEX_PATHS,
    ...detailParamGroups.flatMap((params, index) => {
      const [segment] = COMPENDIUM_DETAIL_ROUTES[index];
      return params.map(({ id }) => `/compendium/${segment}/${id}`);
    }),
  ];

  return paths.map((path) => ({ url: absoluteSiteUrl(path) }));
}

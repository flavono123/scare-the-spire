import { generateLocalizedStaticParams } from "@/lib/codex-static-params";
import {
  getSts1Cards,
  getSts1Characters,
  getSts1Monsters,
  getSts1Potions,
  getSts1Powers,
  getSts1Relics,
  sts1RouteIds,
} from "./data";
import { getSts1Achievements, getSts1Ascensions, getSts1Blights, getSts1CompendiumKeywords, getSts1Modifiers, getSts1ScoreBonuses } from "./compendium-extras";
import { getSts1Events } from "./events";

export async function generateSts1CardStaticParams() {
  return sts1RouteIds(await getSts1Cards());
}

export async function generateSts1RelicStaticParams() {
  return sts1RouteIds(await getSts1Relics());
}

export async function generateSts1PotionStaticParams() {
  return sts1RouteIds(await getSts1Potions());
}

export async function generateSts1PowerStaticParams() {
  return sts1RouteIds(await getSts1Powers());
}

export async function generateSts1MonsterStaticParams() {
  return sts1RouteIds(await getSts1Monsters());
}

export async function generateSts1CharacterStaticParams() {
  return sts1RouteIds(await getSts1Characters());
}

export function generateSts1LocalizedCardStaticParams() {
  return generateLocalizedStaticParams(generateSts1CardStaticParams);
}

export function generateSts1LocalizedRelicStaticParams() {
  return generateLocalizedStaticParams(generateSts1RelicStaticParams);
}

export function generateSts1LocalizedPotionStaticParams() {
  return generateLocalizedStaticParams(generateSts1PotionStaticParams);
}

export function generateSts1LocalizedPowerStaticParams() {
  return generateLocalizedStaticParams(generateSts1PowerStaticParams);
}

export function generateSts1LocalizedMonsterStaticParams() {
  return generateLocalizedStaticParams(generateSts1MonsterStaticParams);
}

export function generateSts1LocalizedCharacterStaticParams() {
  return generateLocalizedStaticParams(generateSts1CharacterStaticParams);
}

export async function generateSts1EventsStaticParams() {
  return sts1RouteIds(await getSts1Events());
}

export async function generateSts1KeywordsStaticParams() {
  return sts1RouteIds(await getSts1CompendiumKeywords());
}

export async function generateSts1ModifiersStaticParams() {
  return sts1RouteIds(await getSts1Modifiers());
}

export async function generateSts1BlightsStaticParams() {
  return sts1RouteIds(await getSts1Blights());
}

export function generateSts1LocalizedEventsStaticParams() {
  return generateLocalizedStaticParams(generateSts1EventsStaticParams);
}

export function generateSts1LocalizedKeywordsStaticParams() {
  return generateLocalizedStaticParams(generateSts1KeywordsStaticParams);
}

export function generateSts1LocalizedModifiersStaticParams() {
  return generateLocalizedStaticParams(generateSts1ModifiersStaticParams);
}

export function generateSts1LocalizedBlightsStaticParams() {
  return generateLocalizedStaticParams(generateSts1BlightsStaticParams);
}

export async function generateSts1AscensionsStaticParams() {
  return sts1RouteIds(await getSts1Ascensions());
}

export async function generateSts1AchievementsStaticParams() {
  return sts1RouteIds(await getSts1Achievements());
}

export function generateSts1LocalizedAscensionsStaticParams() {
  return generateLocalizedStaticParams(generateSts1AscensionsStaticParams);
}

export function generateSts1LocalizedAchievementsStaticParams() {
  return generateLocalizedStaticParams(generateSts1AchievementsStaticParams);
}

export async function generateSts1ScoreBonusesStaticParams() {
  return sts1RouteIds((await getSts1ScoreBonuses()).filter((row) => !row.total));
}

export function generateSts1LocalizedScoreBonusesStaticParams() {
  return generateLocalizedStaticParams(generateSts1ScoreBonusesStaticParams);
}

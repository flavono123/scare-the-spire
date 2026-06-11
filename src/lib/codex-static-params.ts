import {
  getCodexAfflictions,
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
  getCodexEncounters,
  getCodexEpochs,
  getCodexEvents,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "@/lib/codex-data";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";

type StaticIdParam = { id: string };

function idParams(rows: { id: string }[]): StaticIdParam[] {
  return rows.map((row) => ({ id: row.id.toLowerCase() }));
}

export async function generateAncientStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexAncients());
}

export async function generateCardStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexCards({ includeDeprecated: true }));
}

export async function generateCharacterStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexCharacters());
}

export async function generateEnchantmentStaticParams(): Promise<StaticIdParam[]> {
  const [enchantments, afflictions] = await Promise.all([
    getCodexEnchantments(),
    getCodexAfflictions(),
  ]);
  return idParams([...enchantments, ...afflictions]);
}

export async function generateEncounterStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexEncounters());
}

export async function generateEpochStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexEpochs());
}

export async function generateEventStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexEvents());
}

export async function generateKeywordStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexKeywords());
}

export async function generateMonsterStaticParams(): Promise<StaticIdParam[]> {
  const monsters = await getCodexMonsters();
  return idParams(monsters.filter((monster) => monster.showInCompendium && isPublicBestiaryMonster(monster.id)));
}

export async function generatePotionStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexPotions());
}

export async function generatePowerStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexPowers({ includeDeprecated: true }));
}

export async function generateRelicStaticParams(): Promise<StaticIdParam[]> {
  return idParams(await getCodexRelics());
}

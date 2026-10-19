/**
 * Builds the combat simulator's per-version catalog on the server (dev only).
 *
 * Cards, monsters and encounters come from the versioned entity API
 * (`getVersionedEntity`, whose text follows the localization history). What the
 * site data does not carry is read from the build archive
 * (`~/sts2-builds/<version>`, override with STS2_BUILDS_DIR):
 * - card TargetType: `canonical/cards.json` (falls back to the current card data),
 * - encounter composition: `src/.../Encounters/<Encounter>.cs` (`ModelDb.Monster<X>().ToMutable(), "slot"`),
 * - power and affliction text the site does not ship (e.g. GRASP_POWER, WEIGHTED):
 *   `canonical/loc/kor/{powers,afflictions}.json`.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getCodexAfflictions, getCodexCharacters, getCodexPowers } from "../codex-data";
import type { CodexCard, CodexEncounter, CodexMonster } from "../codex-types";
import { getVersionedEntity } from "../versioned-entity-api";
import { inputCardIds, parsePowerSpec } from "./engine";
import { AFFLICTION_HOOKS } from "./hooks";
import type {
  CombatSimInput,
  SimAfflictionDef,
  SimCardDef,
  SimCardType,
  SimCatalog,
  SimKeyword,
  SimMonsterDef,
  SimPowerDef,
} from "./types";

export function archiveRoot(): string {
  return process.env.STS2_BUILDS_DIR ?? path.join(os.homedir(), "sts2-builds");
}

export function archiveDir(version: string): string | null {
  const dir = path.join(archiveRoot(), version.replace(/^v/, ""));
  return existsSync(dir) ? dir : null;
}

async function readArchiveJson<T>(version: string, relative: string): Promise<T | null> {
  const dir = archiveDir(version);
  if (!dir) return null;
  try {
    return JSON.parse(await readFile(path.join(dir, relative), "utf8")) as T;
  } catch {
    return null;
  }
}

const CARD_TYPES: Record<string, SimCardType> = {
  공격: "Attack",
  스킬: "Skill",
  파워: "Power",
  상태이상: "Status",
  저주: "Curse",
  퀘스트: "Quest",
};

const KEYWORDS: Record<string, SimKeyword> = {
  소멸: "Exhaust",
  사용불가: "Unplayable",
  휘발성: "Ethereal",
  보존: "Retain",
  선천성: "Innate",
  교활: "Sly",
  영구: "Eternal",
};

/** `AxebotsNormal` -> `AXEBOTS_NORMAL`. */
export function pascalToId(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

/** `AXEBOTS_NORMAL` -> `AxebotsNormal`. */
export function idToPascal(id: string): string {
  return id.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

/** Monsters the archived encounter class generates, in order, with their slot names. */
export async function readArchiveEncounterMonsters(
  version: string,
  encounterId: string,
): Promise<{ monsterId: string; slot: string | null }[] | null> {
  const dir = archiveDir(version);
  if (!dir) return null;
  const file = path.join(dir, "src/MegaCrit.Sts2.Core.Models.Encounters", `${idToPascal(encounterId)}.cs`);
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch {
    return null;
  }
  const pattern = /ModelDb\.Monster<(\w+)>\(\)\.ToMutable\(\),\s*(?:"([^"]+)"|\(string\)null)/g;
  const monsters = [...source.matchAll(pattern)].map((match) => ({ monsterId: pascalToId(match[1]), slot: match[2] ?? null }));
  return monsters.length > 0 ? monsters : null;
}

type ArchiveCards = Record<string, { target?: string }>;
type ArchiveLoc = Record<string, string>;

export interface CatalogLoad {
  catalog: SimCatalog;
  warnings: string[];
  /** Versioned site entities, for the scene to render. */
  entities: {
    cards: Record<string, CodexCard>;
    monsters: Record<string, CodexMonster>;
    encounter: CodexEncounter | null;
  };
}

export async function loadCombatSimCatalog(input: CombatSimInput): Promise<CatalogLoad> {
  const version = input.version.replace(/^v/, "");
  const locale = "kor" as const;
  const warnings: string[] = [];
  if (!archiveDir(version)) warnings.push(`빌드 아카이브 없음: ${path.join(archiveRoot(), version)}`);

  const [characters, sitePowers, siteAfflictions, archiveCards, archivePowerLoc, archiveAfflictionLoc, currentCards] = await Promise.all([
    getCodexCharacters({ gameLocale: locale }),
    getCodexPowers({ gameLocale: locale, includeDeprecated: true }),
    getCodexAfflictions({ gameLocale: locale }),
    readArchiveJson<ArchiveCards>(version, "canonical/cards.json"),
    readArchiveJson<ArchiveLoc>(version, "canonical/loc/kor/powers.json"),
    readArchiveJson<ArchiveLoc>(version, "canonical/loc/kor/afflictions.json"),
    readFile(path.join(process.cwd(), "data/sts2/kor/cards.json"), "utf8")
      .then((text) => JSON.parse(text) as { id: string; target?: string }[])
      .catch(() => []),
  ]);

  const characterId = input.character.toUpperCase();
  const character = characters.find((entry) => entry.id === characterId);
  if (!character) throw new Error(`unknown character: ${input.character}`);

  const encounterId = input.encounter.toUpperCase();
  const encounterResult = await getVersionedEntity<CodexEncounter>({ entityType: "encounter", entityId: encounterId, version, locale });
  const encounter = encounterResult.entity;
  if (!encounter) throw new Error(`unknown encounter: ${input.encounter}`);
  if (!encounterResult.isAvailable) warnings.push(`${encounterId}는 v${version}에 없는 조우입니다`);

  const archiveMonsters = await readArchiveEncounterMonsters(version, encounterId);
  const siteComposition = encounter.compositions?.[0];
  const monsterSlots = archiveMonsters
    ?? siteComposition?.slots.map((slot, index) => ({ monsterId: slot[0].id, slot: siteComposition.slotNames[index] ?? null }))
    ?? encounter.monsters.map((monster) => ({ monsterId: monster.id, slot: null }));
  if (!archiveMonsters) warnings.push(`조우 구성은 사이트 데이터(현재 기준)를 썼습니다: ${encounterId}`);

  const monsters: Record<string, SimMonsterDef> = {};
  const monsterEntities: Record<string, CodexMonster> = {};
  for (const monsterId of new Set(monsterSlots.map((slot) => slot.monsterId))) {
    const result = await getVersionedEntity<CodexMonster>({ entityType: "monster", entityId: monsterId, version, locale });
    const monster = result.entity;
    if (!monster) {
      warnings.push(`몬스터 데이터 없음: ${monsterId}`);
      continue;
    }
    monsterEntities[monsterId] = monster;
    const damageOf = (key: string | null | undefined) => (key ? monster.damageValues?.[key]?.normal ?? undefined : undefined);
    monsters[monsterId] = {
      id: monsterId,
      name: monster.name,
      hp: monster.minHp ?? 1,
      initialMove: monster.moveGraph?.initial ?? monster.moves[0]?.id ?? null,
      transitions: (monster.moveGraph?.transitions ?? []).map((edge) => ({
        from: edge.from,
        to: edge.to,
        weight: typeof edge.chance === "number" ? edge.chance : 1,
      })),
      moves: Object.fromEntries(monster.moves.map((move) => [move.id, {
        id: move.id,
        name: move.name ?? null,
        intents: (move.intentDetails ?? []).map((intent) => ({
          type: intent.type,
          damage: damageOf(intent.damageKey),
          repeat: intent.repeat?.normal ?? undefined,
        })),
      }])),
    };
  }

  const cards: Record<string, SimCardDef> = {};
  const cardEntities: Record<string, CodexCard> = {};
  for (const cardId of inputCardIds(input)) {
    const result = await getVersionedEntity<CodexCard>({ entityType: "card", entityId: cardId, version, locale });
    const card = result.entity;
    if (!card) {
      warnings.push(`카드 데이터 없음: ${cardId}`);
      continue;
    }
    if (!result.isAvailable) warnings.push(`${cardId}는 v${version}에 없는 카드입니다`);
    cardEntities[cardId] = card;
    const target = archiveCards?.[cardId]?.target ?? currentCards.find((entry) => entry.id === cardId)?.target ?? "None";
    cards[cardId] = {
      id: cardId,
      name: card.name,
      type: CARD_TYPES[card.type] ?? "Other",
      target,
      cost: card.cost,
      isXCost: card.isXCost,
      vars: Object.fromEntries(Object.entries(card.vars ?? {}).filter(([, value]) => typeof value === "number")),
      upgrade: card.upgrade,
      keywords: card.keywords.map((keyword) => KEYWORDS[keyword]).filter((keyword): keyword is SimKeyword => Boolean(keyword)),
    };
  }

  const powers: Record<string, SimPowerDef> = {};
  const powerIds = new Set(Object.values(input.powers ?? {}).flat().map((spec) => parsePowerSpec(spec).id));
  for (const powerId of powerIds) {
    const site = sitePowers.find((power) => power.id === powerId);
    const title = archivePowerLoc?.[`${powerId}.title`];
    if (site) powers[powerId] = { id: powerId, name: site.name, description: site.description };
    else if (title) powers[powerId] = { id: powerId, name: title, description: archivePowerLoc?.[`${powerId}.description`] ?? "" };
    else warnings.push(`파워 문구 없음: ${powerId}`);
  }

  const afflictions: Record<string, SimAfflictionDef> = {};
  for (const afflictionId of Object.keys(AFFLICTION_HOOKS)) {
    const site = siteAfflictions.find((affliction) => affliction.id === afflictionId);
    const title = archiveAfflictionLoc?.[`${afflictionId}.title`];
    if (site) {
      afflictions[afflictionId] = { id: afflictionId, name: site.name, description: site.description, extraCardText: site.extraCardText };
    } else if (title) {
      afflictions[afflictionId] = {
        id: afflictionId,
        name: title,
        description: archiveAfflictionLoc?.[`${afflictionId}.description`] ?? "",
        extraCardText: archiveAfflictionLoc?.[`${afflictionId}.extraCardText`] ?? null,
      };
    }
  }

  return {
    catalog: {
      version,
      character: { id: character.id, name: character.name, hp: character.startingHp, maxEnergy: character.maxEnergy },
      encounter: { id: encounterId, name: encounter.name, monsters: monsterSlots },
      cards,
      monsters,
      powers,
      afflictions,
    },
    warnings,
    entities: { cards: cardEntities, monsters: monsterEntities, encounter },
  };
}

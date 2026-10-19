/**
 * Builds the combat simulator's per-version catalog on the server (dev only).
 *
 * Cards, monsters and encounters come from the versioned entity API
 * (`getVersionedEntity`, whose text follows the localization history). What the
 * site data does not carry is read from the build archive
 * (`~/sts2-builds/<version>`, override with STS2_BUILDS_DIR):
 * - card TargetType: `canonical/cards.json` (falls back to the current card data),
 * - move intents the versioned monster lost (e.g. AXEBOT before v0.104.0):
 *   `canonical/monsters.json`,
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
import { inputCardIds, parsePowerSpec, sceneParts } from "./engine";
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

async function readArchiveSource(version: string, relative: string): Promise<string | null> {
  const dir = archiveDir(version);
  if (!dir) return null;
  try {
    return await readFile(path.join(dir, "src", relative), "utf8");
  } catch {
    return null;
  }
}

/** CharacterModel.AttackAnimDelay from `Characters/<Character>.cs`, in seconds. */
export async function readArchiveAttackAnimDelay(version: string, characterId: string): Promise<number | null> {
  const source = await readArchiveSource(version, `MegaCrit.Sts2.Core.Models.Characters/${idToPascal(characterId)}.cs`);
  const match = source?.match(/AttackAnimDelay\s*=>\s*([0-9.]+)f/);
  return match ? Number(match[1]) : null;
}

/**
 * `WithAttackerAnim(name, delay)` per move from `Monsters/<Monster>.cs`: each
 * `<Name>Move` state machine body, keyed by move id (`HammerUppercut` -> `HAMMER_UPPERCUT`).
 */
export async function readArchiveMoveAnimDelays(version: string, monsterId: string): Promise<Record<string, number> | null> {
  const source = await readArchiveSource(version, `MegaCrit.Sts2.Core.Models.Monsters/${idToPascal(monsterId)}.cs`);
  if (!source) return null;
  const delays: Record<string, number> = {};
  const starts = [...source.matchAll(/struct _003C(\w+?)Move_003Ed__\d+/g)];
  starts.forEach((start, index) => {
    const body = source.slice(start.index, starts[index + 1]?.index ?? source.length);
    const anim = body.match(/WithAttackerAnim\("[^"]*",\s*([0-9.]+)f/);
    if (anim) delays[pascalToId(start[1])] = Number(anim[1]);
  });
  return delays;
}

type ArchiveCards = Record<string, { target?: string }>;
type ArchiveLoc = Record<string, string>;
type ArchiveIntent = { type: string; damage_key?: string; repeat?: { normal: number | null } | null };
type ArchiveMonsters = Record<string, {
  damageValues?: Record<string, { normal: number | null }>;
  moves?: Record<string, { intentDetails?: ArchiveIntent[] }>;
}>;

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

  // Load only what the scene parts use: no character data without a character,
  // no card data or affliction text without the card interface.
  const parts = sceneParts(input);
  const withCards = parts.includes("cards");
  if (parts.length > 0 && !input.character) throw new Error(`${parts.join(", ")} 파트에는 character가 필요합니다`);
  const none = <T,>(value: T) => Promise.resolve(value);
  const [characters, sitePowers, siteAfflictions, archiveCards, archiveMonsterData, archivePowerLoc, archiveAfflictionLoc, currentCards] = await Promise.all([
    input.character ? getCodexCharacters({ gameLocale: locale }) : none([]),
    getCodexPowers({ gameLocale: locale, includeDeprecated: true }),
    withCards ? getCodexAfflictions({ gameLocale: locale }) : none([]),
    withCards ? readArchiveJson<ArchiveCards>(version, "canonical/cards.json") : none(null),
    readArchiveJson<ArchiveMonsters>(version, "canonical/monsters.json"),
    readArchiveJson<ArchiveLoc>(version, "canonical/loc/kor/powers.json"),
    withCards ? readArchiveJson<ArchiveLoc>(version, "canonical/loc/kor/afflictions.json") : none(null),
    withCards
      ? readFile(path.join(process.cwd(), "data/sts2/kor/cards.json"), "utf8")
        .then((text) => JSON.parse(text) as { id: string; target?: string }[])
        .catch(() => [])
      : none([] as { id: string; target?: string }[]),
  ]);

  const characterId = input.character?.toUpperCase() ?? null;
  const character = characterId ? characters.find((entry) => entry.id === characterId) ?? null : null;
  if (characterId && !character) throw new Error(`unknown character: ${input.character}`);
  const attackAnimDelay = characterId ? await readArchiveAttackAnimDelay(version, characterId) : null;
  if (characterId && attackAnimDelay === null) warnings.push(`${characterId} AttackAnimDelay를 아카이브에서 읽지 못해 0으로 둡니다`);

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
    const animDelays = await readArchiveMoveAnimDelays(version, monsterId);
    if (!animDelays) warnings.push(`${monsterId} 공격 애니메이션 지연을 아카이브에서 읽지 못해 0으로 둡니다`);
    const damageOf = (key: string | null | undefined) => (key ? monster.damageValues?.[key]?.normal ?? undefined : undefined);
    const archiveMonster = archiveMonsterData?.[monsterId];
    const archiveDamageOf = (key: string | undefined) => (key ? archiveMonster?.damageValues?.[key]?.normal ?? undefined : undefined);
    const intentsOf = (move: CodexMonster["moves"][number]) => {
      if (move.intentDetails?.length) {
        return move.intentDetails.map((intent) => ({
          type: intent.type,
          damage: damageOf(intent.damageKey),
          repeat: intent.repeat?.normal ?? undefined,
        }));
      }
      const archived = archiveMonster?.moves?.[move.id]?.intentDetails;
      if (!archived?.length) return [];
      warnings.push(`${monsterId} ${move.id} 의도는 아카이브 canonical/monsters.json에서 읽었습니다`);
      return archived.map((intent) => ({
        type: intent.type,
        damage: archiveDamageOf(intent.damage_key),
        repeat: intent.repeat?.normal ?? undefined,
      }));
    };
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
        intents: intentsOf(move),
        // AttackCommand.FromMonster leaves the delay at 0 unless the move calls WithAttackerAnim.
        attackAnimDelay: animDelays?.[move.id] ?? 0,
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
  for (const afflictionId of withCards ? Object.keys(AFFLICTION_HOOKS) : []) {
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
      character: character
        ? { id: character.id, name: character.name, hp: character.startingHp, maxEnergy: character.maxEnergy, attackAnimDelay: attackAnimDelay ?? 0 }
        : null,
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

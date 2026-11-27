import fs from "fs/promises";
import path from "path";
import type { Card, Change, Story, Relic, Potion, CardClass, CardType, CharacterClass, PotionRarity, STS2Patch, STS2Change, STS2PatchLine, EntityVersionDiff, CodexMeta } from "./types";
import { normalizeVersionedEntityType } from "./codex-versioning";
import type { GameLocale } from "./i18n";
import { localizeVersionDiffs, type LocalizationHistory } from "./localization-history";
import { stripNameCounterPlaceholder } from "./game-name-placeholders";
import { getGameplayCardRarityLabels, getGameplayCardTypeLabels } from "./codex-game-ui";
import { readGameLocalizationTable } from "./game-localization";
import { readJsonFile } from "./read-json-file";

function toSlug(name: string, cardClass?: string): string {
  const base = name
    .toLowerCase()
    .replace(/\./g, "")          // J.A.X. -> JAX
    .replace(/'/g, "")           // Ascender's -> Ascenders
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  // Cards with identical names across classes need class suffix
  const SHARED_NAMES = ["strike", "defend"];
  if (cardClass && SHARED_NAMES.includes(base)) {
    return `${base}-${cardClass}`;
  }
  return base;
}

interface RawCard {
  name: string;
  nameKo: string;
  class: string;
  type: string;
  rarity: string;
  cost: number | string;
  costUpgraded?: number | string;
  description?: string;
  descriptionUpgraded?: string;
  deprecated?: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");

export async function getCards(): Promise<Card[]> {
  const raw: RawCard[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "cards.json"), "utf-8"),
  );
  return raw.map((r) => ({
    id: toSlug(r.name, r.class),
    name: r.name,
    nameKo: r.nameKo,
    class: r.class as CardClass,
    cardType: r.type as CardType,
    rarity: r.rarity as Card["rarity"],
    cost: r.cost as Card["cost"],
    costUpgraded: r.costUpgraded as Card["costUpgraded"],
    description: r.description,
    descriptionUpgraded: r.descriptionUpgraded,
    deprecated: r.deprecated,
  }));
}

interface RawRelic {
  name: string;
  nameKo: string;
  rarity: string;
  character: string | null;
  description: string;
  deprecated?: boolean;
}

export async function getRelics(): Promise<Relic[]> {
  const raw: RawRelic[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "relics.json"), "utf-8"),
  );
  return raw.map((r) => ({
    id: toSlug(r.name),
    name: r.name,
    nameKo: r.nameKo,
    rarity: r.rarity as Relic["rarity"],
    character: r.character as CharacterClass | null,
    description: r.description,
    deprecated: r.deprecated,
  }));
}

interface RawPotion {
  name: string;
  nameKo: string;
  rarity: string;
  character: string | null;
  description: string;
}

export async function getPotions(): Promise<Potion[]> {
  const raw: RawPotion[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "potions.json"), "utf-8"),
  );
  return raw.map((r) => ({
    id: toSlug(r.name),
    name: r.name,
    nameKo: r.nameKo,
    rarity: r.rarity as PotionRarity,
    character: r.character as CharacterClass | null,
    description: r.description,
  }));
}

export async function getChanges(): Promise<Change[]> {
  return readJsonFile(path.join(DATA_DIR, "changes.json"));
}

export async function getStories(): Promise<Story[]> {
  return readJsonFile(path.join(DATA_DIR, "stories.json"));
}

export async function getSTS2Stories(): Promise<Story[]> {
  return readJsonFile(path.join(DATA_DIR, "sts2-stories.json"));
}

export async function getSTS2Patches(): Promise<STS2Patch[]> {
  return readJsonFile(path.join(DATA_DIR, "sts2-patches.json"));
}

export async function getSTS2Changes(): Promise<STS2Change[]> {
  return readJsonFile(path.join(DATA_DIR, "sts2-changes.json"));
}

export async function getSTS2PatchLines(): Promise<STS2PatchLine[]> {
  return readJsonFile(path.join(DATA_DIR, "sts2-patch-lines.json"), stripNameCounterPlaceholder);
}

export function deriveEntityVersionDiffs(changes: readonly STS2Change[]): EntityVersionDiff[] {
  return changes.flatMap((change) => {
    const entityType = normalizeVersionedEntityType(change.entityType);
    if (!change.fieldDiffs?.length || !entityType) return [];
    return [{
      entityType,
      entityId: change.entityId,
      patch: change.patch,
      diffs: change.fieldDiffs,
    }];
  });
}

let localizationHistory: Promise<LocalizationHistory> | null = null;

export function getLocalizationHistory(): Promise<LocalizationHistory> {
  localizationHistory ??= fs
    .readFile(path.join(DATA_DIR, "sts2", "localization-history.json"), "utf-8")
    .then((raw) => JSON.parse(raw) as LocalizationHistory);
  return localizationHistory;
}

/**
 * Version diffs for reconstructing older entities. With a game locale, text
 * diffs follow that locale's pinned history (see localization-history.ts);
 * without one they are the authored diffs, whose wording is Korean.
 */
export async function getEntityVersionDiffs(gameLocale?: GameLocale): Promise<EntityVersionDiff[]> {
  const base = deriveEntityVersionDiffs(await getSTS2Changes());
  const diffs = gameLocale ? localizeVersionDiffs(base, gameLocale, await getLocalizationHistory()) : base;
  return withCardLabelDiffs(diffs, await readGameLocalizationTable(gameLocale ?? "kor", "gameplay_ui"));
}

/**
 * Cards keep the game-locale labels of their type and rarity beside the Korean
 * keys (mapCard). A diff only names the key, so a reverted card kept today's
 * label: an old Power drew the Power frame under a 스킬 plaque. Each key diff
 * brings its label along.
 */
export function withCardLabelDiffs(diffs: EntityVersionDiff[], gameplay: Record<string, string>): EntityVersionDiff[] {
  const labels: Record<string, Record<string, string>> = {
    type: getGameplayCardTypeLabels(gameplay),
    rarity: getGameplayCardRarityLabels(gameplay),
  };
  const label = (field: string, value: unknown) => (typeof value === "string" ? labels[field][value] ?? value : value);
  return diffs.map((entry) => entry.entityType !== "card" ? entry : {
    ...entry,
    diffs: entry.diffs.flatMap((diff) => (
      diff.field in labels && !diff.upgraded
        ? [diff, { field: `${diff.field}Label`, before: label(diff.field, diff.before), after: label(diff.field, diff.after) }]
        : [diff]
    )),
  });
}

export async function getCodexMeta(): Promise<CodexMeta> {
  return JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "sts2/meta.json"), "utf-8"),
  );
}

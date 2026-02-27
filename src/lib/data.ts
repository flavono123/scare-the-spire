import fs from "fs/promises";
import path from "path";
import type { Card, Change, Story, Relic, Potion, CardClass, CardType, CharacterClass, PotionRarity } from "./types";

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
  return JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "changes.json"), "utf-8"),
  );
}

export async function getStories(): Promise<Story[]> {
  return JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "stories.json"), "utf-8"),
  );
}

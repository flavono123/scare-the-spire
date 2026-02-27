import fs from "fs/promises";
import path from "path";
import type { Card, Change, Story, CardClass, CardType } from "./types";

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

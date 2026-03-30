import fs from "fs/promises";
import path from "path";
import {
  CodexCard,
  CodexCharacter,
  CodexRelic,
  CodexPotion,
  CardColor,
  RelicRarityKo,
  RelicPool,
  PotionRarityKo,
  PotionPool,
} from "./codex-types";
// Version reconstruction functions are in entity-versioning.ts (client-safe, no fs)

const DATA_DIR = path.join(process.cwd(), "data/spire-codex");

// Raw spire-codex JSON card shape
interface RawCard {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  vars: Record<string, number> | null;
  cost: number;
  is_x_cost: boolean | null;
  is_x_star_cost: boolean | null;
  star_cost: number | null;
  type: string;
  rarity: string;
  color: string;
  damage: number | null;
  block: number | null;
  hit_count: number | null;
  keywords: string[] | null;
  tags: string[] | null;
  upgrade: Record<string, string | number> | null;
  image_url: string | null;
  beta_image_url: string | null;
}

interface RawCharacter {
  id: string;
  name: string;
  color: string;
  image_url: string;
}

function spireCodexImageToLocal(url: string | null): string | null {
  if (!url) return null;
  // /static/images/cards/abrasive.png -> /images/spire-codex/cards/abrasive.webp
  // /static/images/cards/beta/abrasive.png -> /images/spire-codex/cards-beta/abrasive.webp
  const match = url.match(/\/static\/images\/(.+)/);
  if (!match) return null;
  const relativePath = match[1];
  // Map cards/beta/ subdirectory to cards-beta/
  const mapped = relativePath.replace(/^cards\/beta\//, "cards-beta/");
  // Convert .png extension to .webp
  return `/images/spire-codex/${mapped.replace(/\.png$/, ".webp")}`;
}

function mapCard(kor: RawCard, eng: RawCard): CodexCard {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    vars: kor.vars ?? {},
    cost: kor.cost,
    isXCost: kor.is_x_cost ?? false,
    isXStarCost: kor.is_x_star_cost ?? false,
    starCost: kor.star_cost,
    type: kor.type as CodexCard["type"],
    rarity: kor.rarity as CodexCard["rarity"],
    color: kor.color as CardColor,
    damage: kor.damage,
    block: kor.block,
    hitCount: kor.hit_count,
    keywords: kor.keywords ?? [],
    tags: kor.tags ?? [],
    upgrade: kor.upgrade,
    imageUrl: spireCodexImageToLocal(kor.image_url),
    betaImageUrl: spireCodexImageToLocal(kor.beta_image_url),
  };
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = path.join(DATA_DIR, relativePath);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function getCodexCards(): Promise<CodexCard[]> {
  const [korCards, engCards] = await Promise.all([
    readJson<RawCard[]>("kor/cards.json"),
    readJson<RawCard[]>("eng/cards.json"),
  ]);

  const engById = new Map(engCards.map((c) => [c.id, c]));

  return korCards
    .filter((c) => c.image_url) // exclude cards without images
    .map((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      return mapCard(kor, eng);
    });
}

// Raw spire-codex JSON relic shape
interface RawRelic {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  flavor: string;
  rarity: string;
  pool: string;
  image_url: string | null;
}

function mapRelic(kor: RawRelic, eng: RawRelic): CodexRelic {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    flavor: kor.flavor,
    rarity: kor.rarity as RelicRarityKo,
    pool: kor.pool as RelicPool,
    imageUrl: spireCodexImageToLocal(kor.image_url),
  };
}

export async function getCodexRelics(): Promise<CodexRelic[]> {
  const [korRelics, engRelics] = await Promise.all([
    readJson<RawRelic[]>("kor/relics.json"),
    readJson<RawRelic[]>("eng/relics.json"),
  ]);

  const engById = new Map(engRelics.map((r) => [r.id, r]));

  return korRelics.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapRelic(kor, eng);
  });
}

// Raw spire-codex JSON potion shape
interface RawPotion {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  rarity: string;
  pool: string;
  image_url: string;
}

function mapPotion(kor: RawPotion, eng: RawPotion): CodexPotion {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    rarity: kor.rarity as PotionRarityKo,
    pool: kor.pool as PotionPool,
    imageUrl: spireCodexImageToLocal(kor.image_url) ?? "",
  };
}

export async function getCodexPotions(): Promise<CodexPotion[]> {
  const [korPotions, engPotions] = await Promise.all([
    readJson<RawPotion[]>("kor/potions.json"),
    readJson<RawPotion[]>("eng/potions.json"),
  ]);

  const engById = new Map(engPotions.map((p) => [p.id, p]));

  return korPotions.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapPotion(kor, eng);
  });
}

// Game order for characters
const CHARACTER_ORDER = ["IRONCLAD", "SILENT", "DEFECT", "NECROBINDER", "REGENT"];

export async function getCodexCharacters(): Promise<CodexCharacter[]> {
  const raw = await readJson<RawCharacter[]>("kor/characters.json");

  const mapped = raw.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color as CodexCharacter["color"],
    imageUrl: spireCodexImageToLocal(c.image_url) ?? "",
  }));

  // Sort by game order
  mapped.sort((a, b) => {
    const ai = CHARACTER_ORDER.indexOf(a.id);
    const bi = CHARACTER_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return mapped;
}


import fs from "fs/promises";
import path from "path";
import {
  CodexCard,
  CodexCharacter,
  CodexRelic,
  CodexPotion,
  CodexPower,
  CodexEnchantment,
  CodexEvent,
  EventOption,
  EventPage,
  EventAct,
  CardColor,
  RelicRarityKo,
  RelicPool,
  PotionRarityKo,
  PotionPool,
  PowerType,
  PowerStackType,
} from "./codex-types";
// Version reconstruction functions are in entity-versioning.ts (client-safe, no fs)

const DATA_DIR = path.join(process.cwd(), "data/sts2");

// Raw STS2 JSON card shape (snake_case from API)
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
  // /static/images/cards/abrasive.png -> /images/sts2/cards/abrasive.webp
  // /static/images/cards/beta/abrasive.png -> /images/sts2/cards-beta/abrasive.webp
  const match = url.match(/\/static\/images\/(.+)/);
  if (!match) return null;
  const relativePath = match[1];
  // Map cards/beta/ subdirectory to cards-beta/
  const mapped = relativePath.replace(/^cards\/beta\//, "cards-beta/");
  // Convert .png extension to .webp
  return `/images/sts2/${mapped.replace(/\.png$/, ".webp")}`;
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

// Raw STS2 JSON relic shape
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

// Raw STS2 JSON potion shape
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

// Raw STS2 JSON power shape
interface RawPower {
  id: string;
  name: string;
  description: string;
  description_raw: string | null;
  type: string;
  stack_type: string | null;
  allow_negative: boolean | null;
  image_url: string | null;
}

function mapPower(kor: RawPower, eng: RawPower): CodexPower {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    type: kor.type as PowerType,
    stackType: (kor.stack_type ?? "None") as PowerStackType,
    allowNegative: kor.allow_negative ?? false,
    imageUrl: spireCodexImageToLocal(kor.image_url),
  };
}

export async function getCodexPowers(): Promise<CodexPower[]> {
  const [korPowers, engPowers] = await Promise.all([
    readJson<RawPower[]>("kor/powers.json"),
    readJson<RawPower[]>("eng/powers.json"),
  ]);

  const engById = new Map(engPowers.map((p) => [p.id, p]));

  return korPowers
    .filter((p) => !(p.type === "None" && !p.description))
    .map((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      return mapPower(kor, eng);
    });
}

// Raw STS2 JSON enchantment shape
interface RawEnchantment {
  id: string;
  name: string;
  description: string;
  description_raw: string | null;
  extra_card_text: string | null;
  card_type: string | null;
  is_stackable: boolean;
  image_url: string | null;
}

function mapEnchantment(kor: RawEnchantment, eng: RawEnchantment): CodexEnchantment {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    extraCardText: kor.extra_card_text,
    cardType: (kor.card_type as "Attack" | "Skill" | null),
    isStackable: kor.is_stackable,
    // JSON has image_url: null but icons exist on disk as {id_lowercase}.webp
    imageUrl: `/images/sts2/enchantments/${kor.id.toLowerCase()}.webp`,
  };
}

export async function getCodexEnchantments(): Promise<CodexEnchantment[]> {
  const [korEnchantments, engEnchantments] = await Promise.all([
    readJson<RawEnchantment[]>("kor/enchantments.json"),
    readJson<RawEnchantment[]>("eng/enchantments.json"),
  ]);

  const engById = new Map(engEnchantments.map((e) => [e.id, e]));

  return korEnchantments.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapEnchantment(kor, eng);
  });
}

// Raw STS2 JSON event shape
interface RawEventOption {
  id: string;
  title: string;
  description: string;
}

interface RawEventPage {
  id: string;
  description: string | null;
  options: RawEventOption[] | null;
}

interface RawEvent {
  id: string;
  name: string;
  type: string;
  act: string | null;
  description: string;
  options: RawEventOption[] | null;
  pages: RawEventPage[] | null;
  dialogue: Record<string, unknown> | null;
  epithet: string | null;
  image_url: string | null;
}

function mapEventOptions(opts: RawEventOption[] | null): EventOption[] | null {
  if (!opts || opts.length === 0) return null;
  return opts.map((o) => ({ id: o.id, title: o.title, description: o.description }));
}

function mapEventPages(pages: RawEventPage[] | null): EventPage[] | null {
  if (!pages || pages.length === 0) return null;
  return pages.map((p) => ({
    id: p.id,
    description: p.description,
    options: mapEventOptions(p.options),
  }));
}

function mapEvent(kor: RawEvent, eng: RawEvent, imageFiles: Set<string>): CodexEvent {
  const key = kor.id.toLowerCase();
  const imageUrl = imageFiles.has(key) ? `/images/sts2/events/${key}.webp` : null;
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    act: (kor.act as EventAct | null),
    options: mapEventOptions(kor.options),
    pages: mapEventPages(kor.pages),
    imageUrl,
  };
}

export async function getCodexEvents(): Promise<CodexEvent[]> {
  const EVENTS_IMG_DIR = path.join(process.cwd(), "public/images/sts2/events");
  const [korEvents, engEvents, imgFiles] = await Promise.all([
    readJson<RawEvent[]>("kor/events.json"),
    readJson<RawEvent[]>("eng/events.json"),
    fs.readdir(EVENTS_IMG_DIR).then(
      (files) => new Set(files.filter((f) => f.endsWith(".webp")).map((f) => f.replace(".webp", ""))),
      () => new Set<string>(), // fallback if dir doesn't exist
    ),
  ]);

  const engById = new Map(engEvents.map((e) => [e.id, e]));

  return korEvents.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapEvent(kor, eng, imgFiles);
  });
}


import fs from "fs/promises";
import path from "path";
import { bakeDescription } from "./codex-bake";
import {
  gameNullableText,
  gameText,
  readGameLocalizationTable,
  type GameLocalizationTable,
} from "./game-localization";
import {
  getGameplayCardRarityLabels,
  getGameplayCardTypeLabels,
} from "./codex-game-ui";
import { hasPlaceholderBestiaryArt } from "./bestiary-monster-policy";
import { DEFAULT_GAME_LOCALE_BY_SERVICE, type GameLocale } from "./i18n";
import {
  CodexCard,
  CodexCharacter,
  CodexRelic,
  CodexPotion,
  CodexPower,
  CodexEnchantment,
  CodexAffliction,
  CodexEvent,
  CodexAncient,
  AncientDialogueLine,
  CodexMonster,
  CodexEncounter,
  EventOption,
  EventPage,
  EventAct,
  CardColor,
  CardTypeKo,
  CardRarityKo,
  RelicRarityKo,
  RelicPool,
  PotionRarityKo,
  PotionPool,
  PowerType,
  PowerStackType,
  MonsterType,
  MonsterMove,
  MonsterMoveGraph,
  MonsterSpineAsset,
  MonsterSpineEffectAsset,
  DamageValue,
  EncounterRoomType,
  EncounterMonsterRef,
} from "./codex-types";
import {
  getDefaultTinkerRiderForType,
  getMadSciencePreviewCard,
  getMadScienceVariantId,
  getTinkerCardTypeChoiceKey,
  getTinkerRiderDescriptionKey,
  getTinkerRiderChoiceKey,
  MAD_SCIENCE_CARD_ID,
  MAD_SCIENCE_DEFAULT_IMAGE_URL,
  TINKER_CARD_TYPES,
  TINKER_CARD_TYPE_TO_KO,
  TINKER_CARD_TYPE_CHOICE_LABELS,
  TINKER_CARD_TYPE_CHOICE_LABELS_EN,
  TINKER_RIDER_CHOICE_LABELS,
  TINKER_RIDER_CHOICE_LABELS_EN,
  TINKER_RIDER_IDS_BY_TYPE,
  TINKER_TIME_TITLE_FALLBACK_EN,
  TINKER_TIME_TITLE_FALLBACK_KO,
  TINKER_TIME_TITLE_KEY,
} from "./tinker-time";
// Version reconstruction functions are in entity-versioning.ts (client-safe, no fs)

const DATA_DIR = path.join(process.cwd(), "data/sts2");
const DEFAULT_CODEX_GAME_LOCALE = DEFAULT_GAME_LOCALE_BY_SERVICE.ko;

type PublicImageFileIndex = Record<string, string[]>;

let publicImageFileIndexPromise: Promise<PublicImageFileIndex> | null = null;

async function readPublicImageFileIndex(): Promise<PublicImageFileIndex> {
  publicImageFileIndexPromise ??= fs
    .readFile(path.join(DATA_DIR, "public-image-files.json"), "utf-8")
    .then((raw) => JSON.parse(raw) as PublicImageFileIndex)
    .catch(() => ({}));
  return publicImageFileIndexPromise;
}

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
  powers_applied: { power: string; amount: number }[] | null;
  keywords: string[] | null;
  tags: string[] | null;
  upgrade: Record<string, string | number> | null;
  image_url: string | null;
  beta_image_url: string | null;
  deprecated?: boolean;
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

function cardHasCodexImage(card: RawCard): boolean {
  return Boolean(card.image_url || card.beta_image_url || card.id === MAD_SCIENCE_CARD_ID);
}

function codexCardImageUrl(card: RawCard): string | null {
  return spireCodexImageToLocal(card.image_url) ??
    (card.id === MAD_SCIENCE_CARD_ID ? MAD_SCIENCE_DEFAULT_IMAGE_URL : null);
}

const CARD_VISUAL_COLOR_OVERRIDES: Record<string, CardColor> = {
  CALTROPS: "silent",
  CLASH: "ironclad",
  DISTRACTION: "silent",
  DUAL_WIELD: "ironclad",
  ENTRENCH: "ironclad",
  HELLO_WORLD: "defect",
  OUTMANEUVER: "silent",
  REBOUND: "defect",
  RIP_AND_TEAR: "defect",
  STACK: "defect",
};

function getCardVisualColor(card: RawCard): CardColor | undefined {
  return CARD_VISUAL_COLOR_OVERRIDES[card.id];
}

function powerNameToId(powerName: string): string {
  return powerName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function getAppliedPowerIds(card: RawCard): string[] {
  const powerIds = (card.powers_applied ?? []).map((power) => powerNameToId(power.power));
  return [...new Set(powerIds)];
}

async function scanImageFilenames(relativeDir: string): Promise<Set<string>> {
  const index = await readPublicImageFileIndex();
  return new Set((index[relativeDir] ?? []).filter((file) => file.endsWith(".webp")));
}

async function scanImageSlugs(relativeDir: string): Promise<Set<string>> {
  const files = await scanImageFilenames(relativeDir);
  return new Set(Array.from(files, (file) => file.replace(/\.webp$/, "")));
}

function imageFilenameFromStaticUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/([^/]+)\.png$/);
  return match ? `${match[1]}.webp` : null;
}

function betaFileNameFromOfficialFile(file: string | null): string | null {
  if (!file) return null;
  const match = file.match(/^(.+)\.webp$/);
  return match ? `${match[1]}_beta.webp` : null;
}

function betaImageUrlForFile(
  relativeDir: string,
  filenames: Set<string>,
  file: string | null,
  opts?: { exact?: boolean },
): string | null {
  if (!file) return null;
  if (opts?.exact !== false && filenames.has(file)) return `/images/sts2/${relativeDir}/${file}`;

  const namedBetaFile = betaFileNameFromOfficialFile(file);
  if (namedBetaFile && filenames.has(namedBetaFile)) {
    return `/images/sts2/${relativeDir}/${namedBetaFile}`;
  }

  return null;
}

function buildKeywordLabels(
  korKeywords: GameLocalizationTable,
  gameKeywords: GameLocalizationTable,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [key, koLabel] of Object.entries(korKeywords)) {
    if (!key.endsWith(".title")) continue;
    labels[koLabel] = gameKeywords[key] ?? koLabel;
  }
  return labels;
}

function gameTitleFallback(korFallback: string, engFallback: string, gameLocale: GameLocale): string {
  return gameLocale === "kor" ? korFallback : engFallback;
}

function gameTitleText(
  table: GameLocalizationTable,
  key: string,
  korFallback: string,
  engFallback: string,
  gameLocale: GameLocale,
): string {
  return gameText(table, key, gameTitleFallback(korFallback, engFallback, gameLocale));
}

function localizedGameText(
  table: GameLocalizationTable,
  englishTable: GameLocalizationTable,
  key: string,
  korFallback: string,
  engFallback: string,
  gameLocale: GameLocale,
): string {
  return gameText(
    table,
    key,
    gameLocale === "kor" ? korFallback : gameText(englishTable, key, engFallback),
  );
}

function buildMadScienceLabels(
  gameEvents: GameLocalizationTable,
  engEvents: GameLocalizationTable,
  gameLocale: GameLocale,
) {
  const riderIds = TINKER_CARD_TYPES.flatMap((cardType) => TINKER_RIDER_IDS_BY_TYPE[cardType]);
  const riderChoiceLabels = Object.fromEntries(
    riderIds.map((riderId) => [
      riderId,
      localizedGameText(
        gameEvents,
        engEvents,
        getTinkerRiderChoiceKey(riderId),
        TINKER_RIDER_CHOICE_LABELS[riderId],
        TINKER_RIDER_CHOICE_LABELS_EN[riderId],
        gameLocale,
      ),
    ]),
  );
  const riderChoiceDescriptions = Object.fromEntries(
    riderIds.map((riderId) => [
      riderId,
      localizedGameText(
        gameEvents,
        engEvents,
        getTinkerRiderDescriptionKey(riderId),
        "",
        "",
        gameLocale,
      ),
    ]),
  );

  return {
    eventTitle: localizedGameText(
      gameEvents,
      engEvents,
      TINKER_TIME_TITLE_KEY,
      TINKER_TIME_TITLE_FALLBACK_KO,
      TINKER_TIME_TITLE_FALLBACK_EN,
      gameLocale,
    ),
    riderChoiceDescriptions,
    riderChoiceLabels,
    typeChoiceLabels: Object.fromEntries(
      TINKER_CARD_TYPES.map((cardType) => [
        cardType,
        localizedGameText(
          gameEvents,
          engEvents,
          getTinkerCardTypeChoiceKey(cardType),
          TINKER_CARD_TYPE_CHOICE_LABELS[cardType],
          TINKER_CARD_TYPE_CHOICE_LABELS_EN[cardType],
          gameLocale,
        ),
      ]),
    ) as Record<(typeof TINKER_CARD_TYPES)[number], string>,
  };
}

function mapCard(
  kor: RawCard,
  eng: RawCard,
  gameCards: GameLocalizationTable,
  typeLabels: Record<CardTypeKo, string>,
  rarityLabels: Record<CardRarityKo, string>,
  keywordLabels: Record<string, string>,
  gameLocale: GameLocale,
): CodexCard {
  const vars = kor.vars ?? {};
  const raw = gameText(gameCards, `${kor.id}.description`, kor.description_raw);
  return {
    id: kor.id,
    name: gameTitleText(gameCards, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    description: bakeDescription(raw, vars),
    descriptionRaw: raw,
    vars,
    cost: kor.cost,
    isXCost: kor.is_x_cost ?? false,
    isXStarCost: kor.is_x_star_cost ?? false,
    starCost: kor.star_cost,
    type: kor.type as CodexCard["type"],
    typeLabel: typeLabels[kor.type as CardTypeKo] ?? kor.type,
    rarity: kor.rarity as CodexCard["rarity"],
    rarityLabel: rarityLabels[kor.rarity as CardRarityKo] ?? kor.rarity,
    color: kor.color as CardColor,
    visualColor: getCardVisualColor(kor),
    damage: kor.damage,
    block: kor.block,
    hitCount: kor.hit_count,
    keywords: kor.keywords ?? [],
    keywordLabels,
    tags: kor.tags ?? [],
    appliedPowerIds: getAppliedPowerIds(eng),
    upgrade: kor.upgrade,
    imageUrl: codexCardImageUrl(kor),
    betaImageUrl: spireCodexImageToLocal(kor.beta_image_url),
  };
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = path.join(DATA_DIR, relativePath);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function getCodexCards(opts?: {
  includeDeprecated?: boolean;
  gameLocale?: GameLocale;
}): Promise<CodexCard[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korCards, engCards, gameCards, gameEvents, engEvents, korKeywords, gameKeywords, gameplay] = await Promise.all([
    readJson<RawCard[]>("kor/cards.json"),
    readJson<RawCard[]>("eng/cards.json"),
    readGameLocalizationTable(gameLocale, "cards"),
    readGameLocalizationTable(gameLocale, "events"),
    readGameLocalizationTable("eng", "events"),
    readGameLocalizationTable("kor", "card_keywords"),
    readGameLocalizationTable(gameLocale, "card_keywords"),
    readGameLocalizationTable(gameLocale, "gameplay_ui"),
  ]);

  const engById = new Map(engCards.map((c) => [c.id, c]));
  const keywordLabels = buildKeywordLabels(korKeywords, gameKeywords);
  const typeLabels = getGameplayCardTypeLabels(gameplay);
  const rarityLabels = getGameplayCardRarityLabels(gameplay);
  const madScienceLabels = buildMadScienceLabels(gameEvents, engEvents, gameLocale);
  const includeDeprecated = opts?.includeDeprecated ?? false;

  return korCards
    .filter((c) => cardHasCodexImage(c) && (includeDeprecated || !c.deprecated))
    .flatMap((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      const card = mapCard(kor, eng, gameCards, typeLabels, rarityLabels, keywordLabels, gameLocale);
      if (card.id !== MAD_SCIENCE_CARD_ID) return [card];

      return TINKER_CARD_TYPES.map((cardType) => {
        const typeKo = TINKER_CARD_TYPE_TO_KO[cardType];
        return {
          ...getMadSciencePreviewCard(
            card,
            cardType,
            getDefaultTinkerRiderForType(cardType),
            typeLabels[typeKo] ?? typeKo,
          ),
          id: getMadScienceVariantId(cardType),
          madScienceLabels: {
            eventTitle: madScienceLabels.eventTitle,
            riderChoiceDescriptions: madScienceLabels.riderChoiceDescriptions,
            riderChoiceLabels: madScienceLabels.riderChoiceLabels,
            typeChoiceLabel: madScienceLabels.typeChoiceLabels[cardType],
          },
        };
      });
    });
}

export async function getMadScienceBaseCard(opts?: {
  gameLocale?: GameLocale;
}): Promise<CodexCard | null> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korCards, engCards, gameCards, korKeywords, gameKeywords, gameplay] = await Promise.all([
    readJson<RawCard[]>("kor/cards.json"),
    readJson<RawCard[]>("eng/cards.json"),
    readGameLocalizationTable(gameLocale, "cards"),
    readGameLocalizationTable("kor", "card_keywords"),
    readGameLocalizationTable(gameLocale, "card_keywords"),
    readGameLocalizationTable(gameLocale, "gameplay_ui"),
  ]);

  const kor = korCards.find((card) => card.id === MAD_SCIENCE_CARD_ID);
  if (!kor) return null;

  const engById = new Map(engCards.map((card) => [card.id, card]));
  const keywordLabels = buildKeywordLabels(korKeywords, gameKeywords);
  const typeLabels = getGameplayCardTypeLabels(gameplay);
  const rarityLabels = getGameplayCardRarityLabels(gameplay);
  return mapCard(
    kor,
    engById.get(kor.id) ?? kor,
    gameCards,
    typeLabels,
    rarityLabels,
    keywordLabels,
    gameLocale,
  );
}

// Raw STS2 JSON relic shape
interface RawRelic {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  vars?: Record<string, number> | null;
  flavor: string;
  rarity: string;
  pool: string;
  image_url: string | null;
}

// File suffix -> RelicPool mapping for character-variant images
const VARIANT_SUFFIX_TO_POOL: Record<string, RelicPool> = {
  ironclad: "ironclad",
  silent: "silent",
  defect: "defect",
  necro: "necrobinder",
  necrobinder: "necrobinder",
  regent: "regent",
};

function mapRelic(
  kor: RawRelic,
  eng: RawRelic,
  variantMap: Partial<Record<RelicPool, string>> | null,
  betaImageUrl: string | null,
  gameRelics: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexRelic {
  const baseUrl = spireCodexImageToLocal(kor.image_url);
  const vars = kor.vars ?? {};
  const raw = gameText(
    gameRelics,
    `${kor.id}.description`,
    kor.description_raw ?? kor.description,
  );
  return {
    id: kor.id,
    name: gameTitleText(gameRelics, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    description: bakeDescription(raw, vars),
    descriptionRaw: raw,
    vars,
    flavor: gameText(gameRelics, `${kor.id}.flavor`, kor.flavor),
    rarity: kor.rarity as RelicRarityKo,
    pool: kor.pool as RelicPool,
    imageUrl: variantMap ? null : baseUrl,
    betaImageUrl,
    variantImageUrls: variantMap,
  };
}

/**
 * Scan the relics image directory for character-variant files.
 * Returns a map: base name -> { pool -> local image url }.
 * e.g. "yummy_cookie" -> { ironclad: "/images/sts2/relics/yummy_cookie_ironclad.webp", ... }
 */
async function scanRelicVariants(): Promise<Map<string, Partial<Record<RelicPool, string>>>> {
  const files = await scanImageFilenames("relics");

  const variants = new Map<string, Partial<Record<RelicPool, string>>>();

  for (const file of files) {
    const match = file.match(/^(.+?)_(ironclad|silent|defect|necro|necrobinder|regent)\.webp$/);
    if (!match) continue;
    const [, baseName, suffix] = match;
    const pool = VARIANT_SUFFIX_TO_POOL[suffix];
    if (!pool) continue;

    let map = variants.get(baseName);
    if (!map) {
      map = {};
      variants.set(baseName, map);
    }
    map[pool] = `/images/sts2/relics/${file}`;
  }

  // Only keep entries with 2+ variants (single suffix is just a character-specific relic)
  for (const [key, map] of variants) {
    if (Object.keys(map).length < 2) {
      variants.delete(key);
    }
  }

  return variants;
}

export async function getCodexRelics(opts?: { gameLocale?: GameLocale }): Promise<CodexRelic[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korRelics, engRelics, variantsByBase, betaImageFiles, officialImageFiles, gameRelics] = await Promise.all([
    readJson<RawRelic[]>("kor/relics.json"),
    readJson<RawRelic[]>("eng/relics.json"),
    scanRelicVariants(),
    scanImageFilenames("relics-beta"),
    scanImageFilenames("relics"),
    readGameLocalizationTable(gameLocale, "relics"),
  ]);

  const engById = new Map(engRelics.map((r) => [r.id, r]));

  return korRelics.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    // Extract base name from image_url to match against variants
    const baseMatch = kor.image_url?.match(/\/([^/]+)\.png$/);
    const baseName = baseMatch?.[1] ?? null;
    const variantMap = baseName ? variantsByBase.get(baseName) ?? null : null;
    const imageFile = imageFilenameFromStaticUrl(kor.image_url);
    const betaImageUrl = betaImageUrlForFile(
      "relics-beta",
      betaImageFiles,
      imageFile,
    ) ?? betaImageUrlForFile("relics", officialImageFiles, imageFile, { exact: false });
    return mapRelic(kor, eng, variantMap, betaImageUrl, gameRelics, gameLocale);
  });
}

// Raw STS2 JSON potion shape
interface RawPotion {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  vars?: Record<string, number> | null;
  rarity: string;
  pool: string;
  image_url: string;
}

function mapPotion(
  kor: RawPotion,
  eng: RawPotion,
  gamePotions: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexPotion {
  const vars = kor.vars ?? {};
  const raw = gameText(
    gamePotions,
    `${kor.id}.description`,
    kor.description_raw ?? kor.description,
  );
  return {
    id: kor.id,
    name: gameTitleText(gamePotions, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    description: bakeDescription(raw, vars),
    descriptionRaw: raw,
    vars,
    rarity: kor.rarity as PotionRarityKo,
    pool: kor.pool as PotionPool,
    imageUrl: spireCodexImageToLocal(kor.image_url) ?? "",
  };
}

export async function getCodexPotions(opts?: { gameLocale?: GameLocale }): Promise<CodexPotion[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korPotions, engPotions, gamePotions] = await Promise.all([
    readJson<RawPotion[]>("kor/potions.json"),
    readJson<RawPotion[]>("eng/potions.json"),
    readGameLocalizationTable(gameLocale, "potions"),
  ]);

  const engById = new Map(engPotions.map((p) => [p.id, p]));

  return korPotions.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapPotion(kor, eng, gamePotions, gameLocale);
  });
}

// Game order for characters
const CHARACTER_ORDER = ["IRONCLAD", "SILENT", "DEFECT", "NECROBINDER", "REGENT"];

export async function getCodexCharacters(opts?: { gameLocale?: GameLocale }): Promise<CodexCharacter[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [raw, gameCharacters] = await Promise.all([
    readJson<RawCharacter[]>("kor/characters.json"),
    readGameLocalizationTable(gameLocale, "characters"),
  ]);

  const mapped = raw.map((c) => ({
    id: c.id,
    name: gameText(gameCharacters, `${c.id}.title`, c.name),
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

export async function getCodexCharacterSpineAssets(): Promise<MonsterSpineAsset[]> {
  return readJson<MonsterSpineAsset[]>("character-spine-assets.json").catch(() => []);
}

export async function getCodexAncientSpineAssets(): Promise<MonsterSpineAsset[]> {
  return readJson<MonsterSpineAsset[]>("ancient-spine-assets.json").catch(() => []);
}

export async function getCodexSpineVfxAssets(): Promise<MonsterSpineEffectAsset[]> {
  return readJson<MonsterSpineEffectAsset[]>("spine-vfx-assets.json").catch(() => []);
}

// Raw STS2 JSON power shape
interface RawPower {
  id: string;
  name: string;
  description: string;
  description_raw: string | null;
  vars?: Record<string, number> | null;
  type: string;
  stack_type: string | null;
  allow_negative: boolean | null;
  image_url: string | null;
  deprecated?: boolean;
  deprecatedInPatch?: string;
}

function powerLocalizationBase(gamePowers: GameLocalizationTable, id: string): string {
  const powerKey = `${id}_POWER`;
  return `${powerKey}.title` in gamePowers || `${powerKey}.smartDescription` in gamePowers
    ? powerKey
    : id;
}

function hasPowerLocalizationTitle(gamePowers: GameLocalizationTable, id: string): boolean {
  return `${powerLocalizationBase(gamePowers, id)}.title` in gamePowers;
}

function mapPower(
  kor: RawPower,
  eng: RawPower,
  betaImageUrl: string | null,
  gamePowers: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexPower {
  const vars = kor.vars ?? {};
  const l10nBase = powerLocalizationBase(gamePowers, kor.id);
  const raw = gameText(
    gamePowers,
    `${l10nBase}.smartDescription`,
    gameText(gamePowers, `${l10nBase}.description`, kor.description_raw ?? kor.description),
  );
  return {
    id: kor.id,
    name: gameTitleText(gamePowers, `${l10nBase}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    description: bakeDescription(raw ?? "", vars),
    descriptionRaw: raw,
    vars,
    type: kor.type as PowerType,
    stackType: (kor.stack_type ?? "None") as PowerStackType,
    allowNegative: kor.allow_negative ?? false,
    imageUrl: spireCodexImageToLocal(kor.image_url),
    betaImageUrl,
  };
}

export async function getCodexPowers(opts?: { gameLocale?: GameLocale }): Promise<CodexPower[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korPowers, engPowers, betaImageFiles, officialImageFiles, gamePowers] = await Promise.all([
    readJson<RawPower[]>("kor/powers.json"),
    readJson<RawPower[]>("eng/powers.json"),
    scanImageFilenames("powers-beta"),
    scanImageFilenames("powers"),
    readGameLocalizationTable(gameLocale, "powers"),
  ]);

  const engById = new Map(engPowers.map((p) => [p.id, p]));

  return korPowers
    .filter((p) => !p.deprecated && hasPowerLocalizationTitle(gamePowers, p.id) && !(p.type === "None" && !p.description))
    .map((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      const imageFile = imageFilenameFromStaticUrl(kor.image_url);
      const betaImageUrl = betaImageUrlForFile(
        "powers-beta",
        betaImageFiles,
        imageFile,
      ) ?? betaImageUrlForFile("powers", officialImageFiles, imageFile, { exact: false });
      return mapPower(kor, eng, betaImageUrl, gamePowers, gameLocale);
    });
}

// Raw STS2 JSON enchantment shape
interface RawEnchantment {
  id: string;
  name: string;
  description: string;
  description_raw: string | null;
  extra_card_text: string | null;
  vars?: Record<string, number> | null;
  card_type: string | null;
  is_stackable: boolean;
  image_url: string | null;
}

function mapEnchantment(
  kor: RawEnchantment,
  eng: RawEnchantment,
  gameEnchantments: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexEnchantment {
  const vars = kor.vars ?? {};
  const raw = gameNullableText(gameEnchantments, `${kor.id}.description`, kor.description_raw);
  const extraRaw = gameNullableText(gameEnchantments, `${kor.id}.extraCardText`, kor.extra_card_text);
  return {
    id: kor.id,
    name: gameTitleText(gameEnchantments, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    description: bakeDescription(raw ?? kor.description, vars),
    descriptionRaw: raw,
    extraCardText: extraRaw ? bakeDescription(extraRaw, vars) : extraRaw,
    cardType: (kor.card_type as "Attack" | "Skill" | null),
    isStackable: kor.is_stackable,
    imageUrl: kor.image_url,
  };
}

export async function getCodexEnchantments(opts?: { gameLocale?: GameLocale }): Promise<CodexEnchantment[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korEnchantments, engEnchantments, gameEnchantments] = await Promise.all([
    readJson<RawEnchantment[]>("kor/enchantments.json"),
    readJson<RawEnchantment[]>("eng/enchantments.json"),
    readGameLocalizationTable(gameLocale, "enchantments"),
  ]);

  const engById = new Map(engEnchantments.map((e) => [e.id, e]));

  return korEnchantments.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapEnchantment(kor, eng, gameEnchantments, gameLocale);
  });
}

const AFFLICTION_IMAGE_URLS: Record<string, string> = {
  BOUND: "/images/sts2/powers/chains_of_binding_power.webp",
  ENTANGLED: "/images/sts2/powers/tangled_power.webp",
  GALVANIZED: "/images/sts2/powers/galvanic_power.webp",
  HEXED: "/images/sts2/powers/hex_power.webp",
  RINGING: "/images/sts2/powers/ringing_power.webp",
  SMOG: "/images/sts2/powers/smoggy_power.webp",
};

// Raw STS2 JSON affliction shape
interface RawAffliction {
  id: string;
  name: string;
  description: string;
  description_raw?: string | null;
  extra_card_text: string | null;
  is_stackable: boolean;
}

function mapAffliction(
  kor: RawAffliction,
  eng: RawAffliction,
  gameAfflictions: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexAffliction {
  const raw = gameNullableText(gameAfflictions, `${kor.id}.description`, kor.description_raw ?? kor.description);
  const extraRaw = gameNullableText(gameAfflictions, `${kor.id}.extraCardText`, kor.extra_card_text);
  return {
    id: kor.id,
    name: gameTitleText(gameAfflictions, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    description: bakeDescription(raw ?? kor.description, {}),
    descriptionRaw: raw,
    extraCardText: extraRaw ? bakeDescription(extraRaw, {}) : extraRaw,
    isStackable: kor.is_stackable,
    imageUrl: AFFLICTION_IMAGE_URLS[kor.id] ?? null,
  };
}

export async function getCodexAfflictions(opts?: { gameLocale?: GameLocale }): Promise<CodexAffliction[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korAfflictions, engAfflictions, gameAfflictions] = await Promise.all([
    readJson<RawAffliction[]>("kor/afflictions.json"),
    readJson<RawAffliction[]>("eng/afflictions.json"),
    readGameLocalizationTable(gameLocale, "afflictions"),
  ]);

  const engById = new Map(engAfflictions.map((a) => [a.id, a]));

  return korAfflictions
    .filter((a) => !a.id.startsWith("MOCK_"))
    .map((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      return mapAffliction(kor, eng, gameAfflictions, gameLocale);
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

interface RawDialogueLine {
  order: string;
  speaker: string;
  text: string;
}

interface RawEvent {
  id: string;
  name: string;
  type: string;
  act: string | null;
  description: string;
  options: RawEventOption[] | null;
  pages: RawEventPage[] | null;
  dialogue: Record<string, RawDialogueLine[]> | null;
  epithet: string | null;
  image_url: string | null;
  relics: string[] | null;
}

function hasEventSmartTemplate(text: string | null | undefined): boolean {
  return Boolean(text && /\{[^}]+\}/.test(text));
}

function normalizeEventMarkup(text: string): string {
  return text.replace(/\[sine\]([^\[]+?)\[\/rainbow\]\[\/sine\]/g, "[sine][rainbow]$1[/rainbow][/sine]");
}

type EventDisplayVars = Record<string, string | number>;

function localizedEventPlaceholder(gameLocale: GameLocale, ko: string, en: string): string {
  return gameLocale === "kor" ? ko : en;
}

function eventDisplayVars(eventId: string, gameLocale: GameLocale): EventDisplayVars {
  const randomRelic = localizedEventPlaceholder(gameLocale, "무작위 유물", "a random Relic");
  const randomPotion = localizedEventPlaceholder(gameLocale, "무작위 포션", "a random Potion");

  switch (eventId) {
    case "BATTLEWORN_DUMMY":
      return {
        Setting1Hp: 75,
        Setting2Hp: 150,
        Setting3Hp: 300,
      };
    case "DOLL_ROOM":
      return {
        TakeTimeHpLoss: 5,
        ExamineHpLoss: 15,
        RelicName: localizedEventPlaceholder(gameLocale, "인형 유물", "a Doll Relic"),
      };
    case "MORPHIC_GROVE":
      return {
        IsMultiplayer: 0,
        MaxHp: 5,
      };
    case "RANWID_THE_ELDER":
      return {
        Gold: 100,
        Potion: localizedEventPlaceholder(gameLocale, "포션", "Potion"),
        Relic: localizedEventPlaceholder(gameLocale, "유물", "Relic"),
      };
    case "RELIC_TRADER":
      return {
        TopRelicOwned: localizedEventPlaceholder(gameLocale, "보유 유물", "one of your Relics"),
        TopRelicNew: randomRelic,
        MiddleRelicOwned: localizedEventPlaceholder(gameLocale, "보유 유물", "one of your Relics"),
        MiddleRelicNew: randomRelic,
        BottomRelicOwned: localizedEventPlaceholder(gameLocale, "보유 유물", "one of your Relics"),
        BottomRelicNew: randomRelic,
      };
    case "STONE_OF_ALL_TIME":
      return {
        DrinkRandomPotion: randomPotion,
        DrinkMaxHpGain: 10,
        PushHpLoss: 6,
        PushVigorousAmount: 8,
      };
    case "TABLET_OF_TRUTH":
      return {
        SmashHPGain: 20,
        DecipherMaxHpLoss: 3,
      };
    case "TRIAL":
      return {
        EntrantNumber: "???",
      };
    case "WELCOME_TO_WONGOS":
      return {
        BargainBinCost: 100,
        FeaturedItemCost: 200,
        MysteryBoxCost: 300,
        MysteryBoxCombatCount: 5,
        MysteryBoxRelicCount: 3,
        RandomRelic: randomRelic,
        WongoPointAmount: 0,
        RemainingWongoPointAmount: 0,
        TotalWongoBadgeAmount: 0,
      };
    default:
      return {};
  }
}

function resolveEventText(localized: string, renderedFallback: string, vars: EventDisplayVars = {}): string {
  const normalized = normalizeEventMarkup(localized);
  const fallback = normalizeEventMarkup(renderedFallback);
  if (
    hasEventSmartTemplate(normalized) &&
    Object.keys(vars).length === 0 &&
    fallback &&
    !hasEventSmartTemplate(fallback)
  ) {
    return fallback;
  }
  return bakeDescription(normalized, vars);
}

function mapEventOptions(
  eventId: string,
  pageId: string,
  opts: RawEventOption[] | null,
  fallbackOpts: RawEventOption[] | null,
  gameEvents: GameLocalizationTable,
  gameLocale: GameLocale,
): EventOption[] | null {
  if (!opts || opts.length === 0) return null;
  const fallbackById = new Map((fallbackOpts ?? []).map((o) => [o.id, o]));
  const vars = eventDisplayVars(eventId, gameLocale);
  return opts.map((o) => {
    const fallback = fallbackById.get(o.id) ?? o;
    const baseKey = `${eventId}.pages.${pageId}.options.${o.id}`;
    const title = gameText(gameEvents, `${baseKey}.title`, fallback.title);
    const description = gameText(gameEvents, `${baseKey}.description`, fallback.description);
    return {
      id: o.id,
      title: resolveEventText(title, fallback.title, vars),
      description: resolveEventText(description, fallback.description, vars),
    };
  });
}

function mapEventPages(
  eventId: string,
  pages: RawEventPage[] | null,
  fallbackPages: RawEventPage[] | null,
  gameEvents: GameLocalizationTable,
  gameLocale: GameLocale,
): EventPage[] | null {
  if (!pages || pages.length === 0) return null;
  const fallbackById = new Map((fallbackPages ?? []).map((p) => [p.id, p]));
  const vars = eventDisplayVars(eventId, gameLocale);
  return pages.map((p) => {
    const fallback = fallbackById.get(p.id) ?? p;
    const description = gameNullableText(
      gameEvents,
      `${eventId}.pages.${p.id}.description`,
      fallback.description,
    );
    return {
      id: p.id,
      description: description === null
        ? null
        : resolveEventText(description, fallback.description ?? description, vars),
      options: mapEventOptions(eventId, p.id, p.options, fallback.options, gameEvents, gameLocale),
    };
  });
}

function mapEvent(
  kor: RawEvent,
  eng: RawEvent,
  imageFiles: Set<string>,
  gameEvents: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexEvent {
  const key = kor.id.toLowerCase();
  const imageUrl = imageFiles.has(key) ? `/images/sts2/events/${key}.webp` : null;
  const fallbackEvent = gameLocale === "kor" ? kor : eng;
  const fallbackInitialPage = fallbackEvent.pages?.find((p) => p.id === "INITIAL") ?? null;
  const fallbackDescription = fallbackInitialPage?.description ?? fallbackEvent.description;
  const localizedDescription = gameText(
    gameEvents,
    `${kor.id}.pages.INITIAL.description`,
    gameText(gameEvents, `${kor.id}.description`, fallbackDescription),
  );
  const vars = eventDisplayVars(kor.id, gameLocale);
  return {
    id: kor.id,
    name: gameTitleText(gameEvents, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    description: resolveEventText(localizedDescription, fallbackDescription, vars),
    act: (kor.act as EventAct | null),
    options: mapEventOptions(kor.id, "INITIAL", kor.options, fallbackInitialPage?.options ?? fallbackEvent.options, gameEvents, gameLocale),
    pages: mapEventPages(kor.id, kor.pages, fallbackEvent.pages, gameEvents, gameLocale),
    imageUrl,
  };
}

export async function getCodexEvents(opts?: { gameLocale?: GameLocale }): Promise<CodexEvent[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korEvents, engEvents, imgFiles, gameEvents] = await Promise.all([
    readJson<RawEvent[]>("kor/events.json"),
    readJson<RawEvent[]>("eng/events.json"),
    scanImageSlugs("events"),
    readGameLocalizationTable(gameLocale, "events"),
  ]);

  const engById = new Map(engEvents.map((e) => [e.id, e]));

  return korEvents
    .filter((e) => {
      // Exclude ancients (have image_url pointing to ancients assets)
      if (e.image_url?.includes("/ancients/")) return false;
      // Exclude placeholder events with no description
      if (!e.description) return false;
      return true;
    })
    .map((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      return mapEvent(kor, eng, imgFiles, gameEvents, gameLocale);
    });
}

function ancientTalkGroup(group: string): string {
  if (group === "Returning") return "ANY";
  if (group === "First Visit") return "firstVisitEver";
  return group.toUpperCase();
}

function ancientTalkSpeaker(speaker: "ancient" | "character"): string {
  return speaker === "character" ? "char" : "ancient";
}

function mapAncient(
  kor: RawEvent,
  eng: RawEvent,
  gameAncients: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexAncient {
  const key = kor.id.toLowerCase();
  const imageUrl = `/images/sts2/ancients/${key}.webp`;

  // Map dialogue: each key has an array of { order, speaker, text }
  const dialogue: Record<string, AncientDialogueLine[]> = {};
  if (kor.dialogue) {
    for (const [charKey, lines] of Object.entries(kor.dialogue)) {
      const group = ancientTalkGroup(charKey);
      dialogue[charKey] = (lines as RawDialogueLine[]).map((l) => ({
        order: l.order,
        speaker: l.speaker as "ancient" | "character",
        text: gameText(
          gameAncients,
          `${kor.id}.talk.${group}.${l.order}.${ancientTalkSpeaker(l.speaker as "ancient" | "character")}`,
          l.text,
        ),
      }));
    }
  }

  return {
    id: kor.id,
    name: gameTitleText(gameAncients, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    epithet: gameText(gameAncients, `${kor.id}.epithet`, kor.epithet ?? ""),
    epithetEn: eng.epithet ?? "",
    description: gameText(
      gameAncients,
      `${kor.id}.talk.firstVisitEver.0-0.ancient`,
      kor.description,
    ),
    act: (kor.act as EventAct) ?? null,
    relicIds: kor.relics ?? [],
    dialogue,
    imageUrl,
  };
}

export async function getCodexAncients(opts?: { gameLocale?: GameLocale }): Promise<CodexAncient[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korEvents, engEvents, gameAncients] = await Promise.all([
    readJson<RawEvent[]>("kor/events.json"),
    readJson<RawEvent[]>("eng/events.json"),
    readGameLocalizationTable(gameLocale, "ancients"),
  ]);

  const engById = new Map(engEvents.map((e) => [e.id, e]));

  return korEvents
    .filter((e) => e.type === "Ancient")
    .map((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      return mapAncient(kor, eng, gameAncients, gameLocale);
    });
}

// Raw STS2 JSON monster shape
interface RawMonsterMove {
  id: string;
  name: string;
}

interface RawDamageValue {
  normal: number | null;
  ascension: number | null;
}

interface RawMonster {
  id: string;
  name: string;
  type: string;
  min_hp: number | null;
  max_hp: number | null;
  min_hp_ascension: number | null;
  max_hp_ascension: number | null;
  show_in_compendium?: boolean;
  moves: RawMonsterMove[];
  bestiary_moves?: RawMonsterMove[];
  move_graph?: MonsterMoveGraph | null;
  damage_values: Record<string, RawDamageValue> | null;
  block_values: Record<string, number> | null;
  image_url: string | null;
  deprecated?: boolean;
  deprecatedInPatch?: string;
}

function mapMonster(
  kor: RawMonster,
  eng: RawMonster,
  monsterImages: Set<string>,
  bossImages: Set<string>,
  gameMonsters: GameLocalizationTable,
  gameBestiary: GameLocalizationTable,
  engBestiary: GameLocalizationTable,
  gameLocale: GameLocale,
  spineAssets: Map<string, MonsterSpineAsset>,
): CodexMonster {
  const placeholderArt = hasPlaceholderBestiaryArt(kor.id);
  const spineAsset = placeholderArt ? null : (spineAssets.get(kor.id) ?? null);
  const engMovesById = new Map(eng.moves.map((move) => [move.id, move]));
  const mapMoves = (rawMoves: RawMonsterMove[]): MonsterMove[] => rawMoves.map((km) => {
    const em = engMovesById.get(km.id);
    return {
      id: km.id,
      name: gameText(
        gameMonsters,
        `${kor.id}.moves.${km.id}.title`,
        gameTitleFallback(km.name, em?.name ?? km.name, gameLocale),
      ),
      nameEn: em?.name ?? km.name,
      kind: "move",
    };
  });

  const moves = mapMoves(kor.moves);
  const bestiaryMoves = [
    ...mapMoves(kor.bestiary_moves ?? kor.moves),
    ...buildBestiaryAnimationMoves(spineAsset, gameBestiary, engBestiary),
  ];

  // Map damage values
  const damageValues: Record<string, DamageValue> | null = kor.damage_values
    ? Object.fromEntries(
        Object.entries(kor.damage_values).map(([k, v]) => [
          k,
          { normal: v.normal, ascension: v.ascension },
        ]),
      )
    : null;

  // Resolve images separately:
  // imageUrl = Spine render (512x512 portrait) from monsters-render/ dir
  // bossImageUrl = boss encounter token icon from bosses/ dir
  const idLower = kor.id.toLowerCase();
  const imageSlug = resolveMonsterRenderSlug(idLower, kor.image_url, monsterImages);
  const imageUrl = !placeholderArt && imageSlug ? `/images/sts2/monsters-render/${imageSlug}.webp` : null;
  const bossImageUrl = bossImages.has(`${idLower}_boss`)
    ? `/images/sts2/bosses/${idLower}_boss.webp`
    : null;

  return {
    id: kor.id,
    name: gameTitleText(gameMonsters, `${kor.id}.name`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    type: kor.type as MonsterType,
    showInCompendium: kor.show_in_compendium ?? true,
    minHp: kor.min_hp,
    maxHp: kor.max_hp,
    minHpAscension: kor.min_hp_ascension,
    maxHpAscension: kor.max_hp_ascension,
    moves,
    bestiaryMoves,
    moveGraph: kor.move_graph ?? null,
    damageValues: damageValues,
    blockValues: kor.block_values,
    imageUrl,
    bossImageUrl,
    spineAsset,
  };
}

function resolveMonsterRenderSlug(
  idLower: string,
  rawImageUrl: string | null,
  monsterImages: Set<string>,
): string | null {
  if (monsterImages.has(idLower)) return idLower;

  const rawSlug = rawImageUrl?.split("/").pop()?.replace(/\.png$/, "") ?? null;
  if (rawSlug && monsterImages.has(rawSlug)) return rawSlug;

  return null;
}

function buildBestiaryAnimationMoves(
  spineAsset: MonsterSpineAsset | null,
  gameBestiary: GameLocalizationTable,
  engBestiary: GameLocalizationTable,
): MonsterMove[] {
  if (!spineAsset) return [];

  return spineAsset.bestiaryAnimations.map((animationId) => ({
    id: animationId,
    name: gameText(gameBestiary, `ACTION_NAME.${animationId}`, animationId),
    nameEn: gameText(engBestiary, `ACTION_NAME.${animationId}`, animationId),
    kind: "animation",
    animationId,
  }));
}

export async function getCodexMonsters(opts?: { gameLocale?: GameLocale }): Promise<CodexMonster[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korMonsters, engMonsters, spineAssetList, monsterFiles, bossFiles, gameMonsters, gameBestiary, engBestiary] = await Promise.all([
    readJson<RawMonster[]>("kor/monsters.json"),
    readJson<RawMonster[]>("eng/monsters.json"),
    readJson<MonsterSpineAsset[]>("monster-spine-assets.json").catch(() => []),
    scanImageSlugs("monsters-render"),
    scanImageSlugs("bosses"),
    readGameLocalizationTable(gameLocale, "monsters"),
    readGameLocalizationTable(gameLocale, "bestiary"),
    readGameLocalizationTable("eng", "bestiary"),
  ]);

  const engById = new Map(engMonsters.map((m) => [m.id, m]));
  const spineAssets = new Map(spineAssetList.map((asset) => [asset.id, asset]));

  return korMonsters.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapMonster(kor, eng, monsterFiles, bossFiles, gameMonsters, gameBestiary, engBestiary, gameLocale, spineAssets);
  });
}

// Raw STS2 JSON encounter shape
interface RawEncounterMonster {
  id: string;
  name: string;
}

interface RawEncounter {
  id: string;
  name: string;
  room_type: string;
  is_weak: boolean;
  act: string | null;
  tags: string[] | null;
  monsters: RawEncounterMonster[];
  loss_text: string;
  deprecated?: boolean;
  deprecatedInPatch?: string;
}

function mapEncounter(
  kor: RawEncounter,
  eng: RawEncounter,
  bossImages: Set<string>,
  gameEncounters: GameLocalizationTable,
  gameMonsters: GameLocalizationTable,
  gameLocale: GameLocale,
): CodexEncounter {
  const monsters: EncounterMonsterRef[] = kor.monsters.map((km, i) => ({
    id: km.id,
    name: gameText(
      gameMonsters,
      `${km.id}.name`,
      gameTitleFallback(km.name, eng.monsters[i]?.name ?? km.name, gameLocale),
    ),
    nameEn: eng.monsters[i]?.name ?? km.name,
  }));

  // Check for boss encounter image
  let imageUrl: string | null = null;
  const idLower = kor.id.toLowerCase();
  if (bossImages.has(idLower)) {
    imageUrl = `/images/sts2/bosses/${idLower}.webp`;
  }

  return {
    id: kor.id,
    name: gameTitleText(gameEncounters, `${kor.id}.title`, kor.name, eng.name, gameLocale),
    nameEn: eng.name,
    roomType: kor.room_type as EncounterRoomType,
    isWeak: kor.is_weak,
    act: (kor.act as EventAct | null),
    tags: kor.tags,
    monsters,
    lossText: gameText(gameEncounters, `${kor.id}.loss`, kor.loss_text),
    imageUrl,
  };
}

export async function getCodexEncounters(opts?: { gameLocale?: GameLocale }): Promise<CodexEncounter[]> {
  const gameLocale = opts?.gameLocale ?? DEFAULT_CODEX_GAME_LOCALE;
  const [korEncounters, engEncounters, bossFiles, gameEncounters, gameMonsters] = await Promise.all([
    readJson<RawEncounter[]>("kor/encounters.json"),
    readJson<RawEncounter[]>("eng/encounters.json"),
    scanImageSlugs("bosses"),
    readGameLocalizationTable(gameLocale, "encounters"),
    readGameLocalizationTable(gameLocale, "monsters"),
  ]);

  const engById = new Map(engEncounters.map((e) => [e.id, e]));

  return korEncounters.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapEncounter(kor, eng, bossFiles, gameEncounters, gameMonsters, gameLocale);
  });
}

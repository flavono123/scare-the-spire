import coverCooccurrence from "@/data/cover-cooccurrence.json";
import {
  type CoverCooccurrenceTable,
  type CoverElement,
  type CoverElementKind,
  type CoverSpec,
} from "@/lib/run-cover-types";
import { localize, prettifyId } from "@/lib/sts2-i18n";
import {
  isMadScienceCardId,
  MAD_SCIENCE_CARD_ID,
  TINKER_CARD_IMAGE_BY_TYPE,
  getMadScienceVariantPartsFromId,
} from "@/lib/tinker-time";
import type { ReplayRun } from "@/lib/sts2-run-replay";

type Weighted = {
  kind: CoverElementKind;
  id: string;
  weight: number;
  copies: number;
  rarity?: string | null;
  upgraded?: boolean;
};

/** Ranked candidate for cover editor suggestions. */
export type CoverPoolItem = {
  kind: CoverElementKind;
  id: string;
  weight: number;
  copies: number;
};

export type SuggestCoversInput = {
  runId: string;
  run: ReplayRun;
  reshuffle?: number;
  cooccurrence?: CoverCooccurrenceTable;
  /** Optional rarity lookup: card/relic/potion id → Korean rarity label */
  rarityById?: Partial<Record<CoverElementKind, Record<string, string>>>;
};

export type SuggestCoversResult = {
  covers: [CoverSpec, CoverSpec];
};

const DEFAULT_COOCCURRENCE = coverCooccurrence as CoverCooccurrenceTable;

const STARTER_CARD_RE = /^(STRIKE_|DEFEND_)/;
const STARTER_RELICS = new Set([
  "BURNING_BLOOD",
  "RING_OF_THE_SNAKE",
  "CRACKED_CORE",
  "PURE_WATER",
  "SOUL_LANTERN",
]);

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeId(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

function weightedPick<T extends { weight: number }>(
  items: T[],
  seed: string,
): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return items[hashString(seed) % items.length] ?? null;
  let cursor = ((hashString(seed) % 1_000_000) / 1_000_000) * total;
  for (const item of items) {
    cursor -= Math.max(0, item.weight);
    if (cursor <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}

function pairKey(a: Weighted, b: Weighted): string {
  const left = `${a.kind}:${a.id}`;
  const right = `${b.kind}:${b.id}`;
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function displayName(kind: CoverElementKind, id: string): string {
  if (kind === "card" && isMadScienceCardId(id)) {
    return localize("cards", MAD_SCIENCE_CARD_ID) ?? "괴짜 과학";
  }
  const table = kind === "card" ? "cards" : kind === "relic" ? "relics" : "potions";
  return localize(table, id) ?? prettifyId(id);
}

function totalFloors(run: ReplayRun): number {
  let total = 0;
  for (const act of run.map_point_history) total += act.length;
  return total;
}

function buildWeightedPool(
  run: ReplayRun,
  rarityById?: SuggestCoversInput["rarityById"],
): Weighted[] {
  const player = run.players[0];
  if (!player) return [];

  const cards = new Map<string, { copies: number; floors: number[]; upgraded: boolean }>();
  for (const card of player.deck) {
    if (typeof card.id !== "string") continue;
    const id = normalizeId(card.id);
    const entry = cards.get(id) ?? { copies: 0, floors: [], upgraded: false };
    entry.copies += 1;
    if (typeof card.floor_added_to_deck === "number") {
      entry.floors.push(card.floor_added_to_deck);
    }
    if ((card.current_upgrade_level ?? 0) > 0) entry.upgraded = true;
    cards.set(id, entry);
  }

  const pool: Weighted[] = [];
  for (const [id, entry] of cards) {
    let weight = 1;
    const minFloor = entry.floors.length ? Math.min(...entry.floors) : 1;
    if (minFloor > 1) weight += 3;
    if (minFloor > 34) weight += 2;
    if (entry.copies === 2) weight += 4;
    else if (entry.copies === 3) weight += 6;
    else if (entry.copies >= 4) weight += 8;
    if (entry.upgraded) weight += 2;
    const rarity = rarityById?.card?.[id] ?? null;
    if (rarity === "희귀") weight += 2;
    else if (rarity === "고급") weight += 1;
    // Starter family: always down-weight, even when multi-copied.
    if (STARTER_CARD_RE.test(id) || rarity === "기본") weight *= 0.2;
    pool.push({
      kind: "card",
      id,
      weight,
      copies: entry.copies,
      rarity,
      upgraded: entry.upgraded,
    });
  }

  for (const relic of player.relics) {
    if (typeof relic.id !== "string") continue;
    const id = normalizeId(relic.id);
    let weight = 2;
    if ((relic.floor_added_to_deck ?? 0) > 0) weight += 2;
    const rarity = rarityById?.relic?.[id] ?? null;
    if (rarity === "보스" || rarity === "희귀") weight += 3;
    if (STARTER_RELICS.has(id) || rarity === "시작 유물") weight *= 0.4;
    pool.push({ kind: "relic", id, weight, copies: 1, rarity });
  }

  for (const potion of player.potions ?? []) {
    if (typeof potion.id !== "string") continue;
    const id = normalizeId(potion.id);
    if (!id || id === "POTION_SLOT" || id === "NONE") continue;
    let weight = 1;
    const rarity = rarityById?.potion?.[id] ?? null;
    if (rarity === "희귀") weight += 1;
    pool.push({ kind: "potion", id, weight, copies: 1, rarity });
  }

  return pool;
}

function pickElements(
  pool: Weighted[],
  opts: {
    countSeed: string;
    excludeCardIds: string[];
    cooccurrence: CoverCooccurrenceTable;
  },
): CoverElement[] {
  const n = 1 + (hashString(opts.countSeed) % 3);
  let candidates = pool.filter(
    (item) => !(item.kind === "card" && opts.excludeCardIds.includes(item.id)),
  );
  const picked: Weighted[] = [];
  let potionCount = 0;

  for (let i = 0; i < n && candidates.length > 0; i++) {
    const boosted = candidates.map((item) => {
      let weight = item.weight;
      if (item.kind === "potion" && potionCount >= 1) weight *= 0.25;
      for (const chosen of picked) {
        const boost = opts.cooccurrence.pairWeight[pairKey(chosen, item)] ?? 0;
        weight += Math.min(3, boost);
      }
      return { ...item, weight };
    });
    const item = weightedPick(boosted, `${opts.countSeed}:${i}`);
    if (!item) break;
    picked.push(item);
    if (item.kind === "potion") potionCount += 1;
    candidates = candidates.filter(
      (c) => !(c.kind === item.kind && c.id === item.id),
    );
  }

  // Soft prefer mixed kinds when n>=2.
  if (
    picked.length >= 2 &&
    picked[0] &&
    picked[1] &&
    picked[0].kind === picked[1].kind
  ) {
    const median =
      [...candidates.map((c) => c.weight)].sort((a, b) => a - b)[
        Math.floor(candidates.length / 2)
      ] ?? 0;
    const alt = candidates.find(
      (c) => c.kind !== picked[0]!.kind && c.weight >= median,
    );
    if (alt) picked[1] = alt;
  }

  return picked.map((item) => ({
    kind: item.kind,
    id: item.id,
    ...(item.kind === "card" && item.copies >= 2 ? { copies: item.copies } : {}),
  }));
}

function subjectParticle(name: string): "이" | "가" {
  const last = name[name.length - 1];
  if (!last) return "가";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "가";
  return (code - 0xac00) % 28 === 0 ? "가" : "이";
}

function phraseCandidates(
  run: ReplayRun,
  elements: CoverElement[],
): Array<{ id: string; text: string; weight: number }> {
  const player = run.players[0];
  const floors = totalFloors(run);
  const deckSize = player?.deck.length ?? 0;
  const relicCount = player?.relics.length ?? 0;
  const e0 = elements[0];
  const e1 = elements[1];
  const e0Name = e0 ? displayName(e0.kind, e0.id) : "";
  const e1Name = e1 ? displayName(e1.kind, e1.id) : "";
  const applicable: Array<{ id: string; text: string; weight: number }> = [];

  if (e0) {
    applicable.push({
      id: "hook_mash",
      text: (e1 ? `${e0Name} ${e1Name}` : e0Name).slice(0, 18),
      weight: 3,
    });
    applicable.push({ id: "hook_why", text: `${e0Name} 왜 씀`, weight: 2 });
    if (e0.kind === "card" && (e0.copies ?? 1) >= 2) {
      applicable.push({
        id: "hook_copies",
        text: `${e0Name} ${e0.copies}장`,
        weight: 4,
      });
    }
    if (e0.kind === "card") {
      applicable.push({
        id: "hook_not_normal",
        text: `보통 ${e0Name}${subjectParticle(e0Name)} 아니다`,
        weight: 2,
      });
    }
  }
  if (relicCount >= 20) {
    applicable.push({ id: "hook_relics", text: `${relicCount}유물`, weight: 2 });
  }
  if (deckSize >= 40 || deckSize <= 8) {
    applicable.push({ id: "hook_deck", text: `덱 ${deckSize}장`, weight: 2 });
  }
  if (!run.win && floors >= 40) {
    applicable.push({ id: "hook_floor", text: `${floors}층까지`, weight: 2 });
  }
  if (run.win) {
    applicable.push({
      id: "hook_win",
      text: `A${run.ascension} 클리어`,
      weight: 2,
    });
  }

  if (applicable.length === 0) {
    applicable.push({
      id: "hook_fallback",
      text: run.win ? `A${run.ascension} 클리어` : `${floors}층`,
      weight: 1,
    });
  }
  return applicable;
}

function pickPhrase(
  run: ReplayRun,
  elements: CoverElement[],
  phraseSeed: string,
): string {
  const applicable = phraseCandidates(run, elements);
  const picked = weightedPick(applicable, phraseSeed);
  return (picked?.text ?? applicable[0]!.text).slice(0, 40);
}

/** Phrase chips for the cover editor (template/seed based, not pool-ranked). */
export function suggestCoverPhrases(
  run: ReplayRun,
  elements: CoverElement[],
  seed: string,
  count = 5,
): string[] {
  const applicable = [...phraseCandidates(run, elements)].sort(
    (a, b) => b.weight - a.weight,
  );
  const out: string[] = [];
  const seen = new Set<string>();
  // Prefer a seeded pick first, then fill by weight.
  const first = weightedPick(applicable, seed);
  if (first) {
    seen.add(first.text);
    out.push(first.text.slice(0, 40));
  }
  for (const item of applicable) {
    if (out.length >= count) break;
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    out.push(item.text.slice(0, 40));
  }
  // Extra rolls for "다시 굴리기" variety without changing elements.
  let i = 0;
  while (out.length < count && i < applicable.length * 2) {
    const roll = weightedPick(applicable, `${seed}:extra:${i}`);
    i += 1;
    if (!roll || seen.has(roll.text)) continue;
    seen.add(roll.text);
    out.push(roll.text.slice(0, 40));
  }
  return out;
}

function toPoolItem(item: Weighted): CoverPoolItem {
  return {
    kind: item.kind,
    id: item.id,
    weight: item.weight,
    copies: item.copies,
  };
}

function sortByWeightDesc(items: Weighted[]): Weighted[] {
  return [...items].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

/** Ranked element suggestions for the cover editor (run-relevance order). */
export function listRankedCoverElements(
  run: ReplayRun,
  opts?: {
    rarityById?: SuggestCoversInput["rarityById"];
    kind?: CoverElementKind | "all";
    exclude?: Array<{ kind: CoverElementKind; id: string }>;
    /** Background card for cover B — hide from element picks. */
    backgroundCardId?: string | null;
  },
): CoverPoolItem[] {
  const exclude = new Set(
    (opts?.exclude ?? []).map((item) => `${item.kind}:${item.id}`),
  );
  if (opts?.backgroundCardId) {
    exclude.add(`card:${opts.backgroundCardId}`);
  }
  const kind = opts?.kind ?? "all";
  return sortByWeightDesc(buildWeightedPool(run, opts?.rarityById))
    .filter((item) => (kind === "all" ? true : item.kind === kind))
    .filter((item) => !exclude.has(`${item.kind}:${item.id}`))
    .map(toPoolItem);
}

/** Official art missing — beta-only focus art is last resort for cover B. */
const BETA_ONLY_CARD_ART_IDS = new Set([
  "BLAZE",
  "CACOPHONY",
  "HIBERNATE",
  "MIDNIGHT",
  "ONE_FOR_ALL",
  "OUTRAGE",
  "SIDESTEP",
  "UNDERWORLD",
]);

/** Ranked background-card suggestions for cover B (official art preferred). */
export function listRankedCoverBackgroundCards(
  run: ReplayRun,
  opts?: { rarityById?: SuggestCoversInput["rarityById"] },
): CoverPoolItem[] {
  const cards = sortByWeightDesc(
    buildWeightedPool(run, opts?.rarityById).filter((item) => item.kind === "card"),
  );
  const official = cards.filter((item) => !BETA_ONLY_CARD_ART_IDS.has(item.id));
  const betaOnly = cards.filter((item) => BETA_ONLY_CARD_ART_IDS.has(item.id));
  return [...official, ...betaOnly].map(toPoolItem);
}

export function suggestCovers(input: SuggestCoversInput): SuggestCoversResult {
  const reshuffle = input.reshuffle ?? 0;
  const seedBase = `${input.runId}:${reshuffle}`;
  const cooccurrence = input.cooccurrence ?? DEFAULT_COOCCURRENCE;
  const pool = buildWeightedPool(input.run, input.rarityById);
  const cards = pool.filter((item) => item.kind === "card");
  const officialArtCards = cards.filter((item) => !BETA_ONLY_CARD_ART_IDS.has(item.id));
  const focusCard =
    weightedPick(officialArtCards, `${seedBase}:focus`) ??
    weightedPick(cards, `${seedBase}:focus`) ??
    weightedPick(pool, `${seedBase}:focus-any`);

  const elementsA = pickElements(pool, {
    countSeed: `${seedBase}:elA`,
    excludeCardIds: [],
    cooccurrence,
  });
  const elementsB = pickElements(pool, {
    countSeed: `${seedBase}:elB`,
    excludeCardIds: focusCard?.kind === "card" ? [focusCard.id] : [],
    cooccurrence,
  });

  const phraseA = pickPhrase(input.run, elementsA, `${seedBase}:phA`);
  const phraseB = pickPhrase(
    input.run,
    elementsB.length > 0 ? elementsB : elementsA,
    `${seedBase}:phB`,
  );

  const coverA: CoverSpec = {
    background: { kind: "character" },
    phrase: phraseA,
    elements: elementsA,
    auto: true,
    suggestSeed: `${seedBase}:A`,
  };

  const coverB: CoverSpec = {
    background: focusCard
      ? { kind: "card-beta", cardId: focusCard.id }
      : { kind: "character" },
    phrase: phraseB,
    elements: elementsB,
    auto: true,
    suggestSeed: `${seedBase}:B`,
  };

  return { covers: [coverA, coverB] };
}

/** Stable A/B pick for index — alternates by runId. */
export function pickAlternatingCover(
  runId: string,
  run: ReplayRun,
  reshuffle = 0,
): CoverSpec {
  const { covers } = suggestCovers({ runId, run, reshuffle });
  const index = hashString(`${runId}:cover-slot:${reshuffle}`) % 2;
  return covers[index] ?? covers[0]!;
}

/** Default auto-saved cover (alternating A/B). */
export function suggestDefaultCover(
  runId: string,
  run: ReplayRun,
  reshuffle = 0,
): CoverSpec {
  return pickAlternatingCover(runId, run, reshuffle);
}

export function ensureCoverSpec(
  runId: string,
  run: ReplayRun,
  existing: CoverSpec | null | undefined,
): CoverSpec {
  // Manual custom covers win; otherwise re-pick A/B so both variants appear.
  if (
    existing &&
    existing.auto === false &&
    existing.phrase &&
    Array.isArray(existing.elements)
  ) {
    return existing;
  }
  return pickAlternatingCover(runId, run);
}

export function characterSlugFromReplay(character: string | undefined): string {
  if (!character) return "random";
  return character.replace(/^CHARACTER\./, "").toLowerCase();
}

export function coverCharacterSelectSrc(character: string | undefined): string {
  const slug = characterSlugFromReplay(character);
  return `/images/sts2/characters/select_${slug}.webp`;
}

export function coverCharacterPortraitSrc(character: string | undefined): string {
  const slug = characterSlugFromReplay(character);
  return `/images/sts2/characters/char_select_${slug}.webp`;
}

export function coverCardArtSrc(cardId: string): { src: string; beta: string } {
  const parts = getMadScienceVariantPartsFromId(cardId);
  if (parts) {
    const src = TINKER_CARD_IMAGE_BY_TYPE[parts.cardType];
    return { src, beta: src };
  }
  const id = cardId.toLowerCase();
  return {
    src: `/images/sts2/cards/${id}.webp`,
    beta: `/images/sts2/cards-beta/${id}.webp`,
  };
}

export function coverElementImageSrc(element: CoverElement): string {
  if (element.kind === "card") {
    const parts = getMadScienceVariantPartsFromId(element.id);
    if (parts) return TINKER_CARD_IMAGE_BY_TYPE[parts.cardType];
    return `/images/sts2/cards/${element.id.toLowerCase()}.webp`;
  }
  const id = element.id.toLowerCase();
  if (element.kind === "relic") return `/images/sts2/relics/${id}.webp`;
  return `/images/sts2/potions/${id}.webp`;
}

export function characterSpireClass(character: string | undefined): string {
  switch (character) {
    case "CHARACTER.IRONCLAD":
      return "spire-red";
    case "CHARACTER.SILENT":
      return "spire-green";
    case "CHARACTER.DEFECT":
      return "spire-aqua";
    case "CHARACTER.REGENT":
      return "spire-orange";
    case "CHARACTER.NECROBINDER":
      return "spire-pink";
    default:
      return "spire-gold";
  }
}

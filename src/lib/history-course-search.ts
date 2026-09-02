import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import {
  blocksToPlainText,
  entityDisplayNames,
  matchEntities,
} from "@/lib/chemical-utils";
import {
  comboPostMatchesAnyGameElement,
  comboResourceKey,
  type ComboResourceRef,
} from "@/lib/combo-types";
import { historyRunCharacterLabel } from "@/lib/history-run-reference";
import { displayNameForCoverElement } from "@/lib/run-cover-display";
import { resolveCoverPhrase } from "@/lib/run-cover-phrase";
import { coverPhrasePool } from "@/lib/run-cover-suggest";
import type { CoverSpec } from "@/lib/run-cover-types";
import type { DonatedRunSummary } from "@/lib/run-donation";
import { buildSearchTokens } from "@/lib/sts2-build-version";
import type { GameI18nTables } from "@/lib/sts2-game-i18n";
import korTables from "@/lib/sts2-game-i18n/kor.json";
import engTables from "@/lib/sts2-game-i18n/eng.json";
import { localize, prettifyId } from "@/lib/sts2-i18n";
import type {
  ReplayChoice,
  ReplayHistoryEntry,
  ReplayPlayerStats,
  ReplayRun,
} from "@/lib/sts2-run-replay";

const PREFIX_TYPE: Record<string, EntityType> = {
  CHARACTER: "character",
  CARD: "card",
  RELIC: "relic",
  POTION: "potion",
  EVENT: "event",
  ENCOUNTER: "encounter",
  MONSTER: "monster",
  ANCIENT: "ancient",
  POWER: "power",
  ENCHANTMENT: "enchantment",
  AFFLICTION: "affliction",
  EPOCH: "epoch",
  MODIFIER: "modifier",
  ASCENSION: "ascension",
  KEYWORD: "keyword",
};

const TABLE_TYPE: Record<string, EntityType> = {
  events: "event",
  relics: "relic",
  cards: "card",
  potions: "potion",
  ancients: "ancient",
  encounters: "encounter",
  characters: "character",
  monsters: "monster",
  enchantments: "enchantment",
  modifiers: "modifier",
  powers: "power",
};

export interface HistoryCourseSearchDoc {
  runId: string;
  haystack: string;
  resources: ComboResourceRef[];
}

function addResource(
  seen: Set<string>,
  out: ComboResourceRef[],
  resource: ComboResourceRef,
) {
  const key = comboResourceKey(resource);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(resource);
}

function stripLocKey(value: string): string {
  return value.replace(/\.title$/i, "");
}

export function resourceFromReplayId(
  raw: string | null | undefined,
  fallback: EntityType,
): ComboResourceRef | null {
  if (!raw) return null;
  const trimmed = stripLocKey(raw.trim());
  if (!trimmed) return null;
  const dot = trimmed.indexOf(".");
  if (dot <= 0) return { type: fallback, id: trimmed };
  const prefix = trimmed.slice(0, dot).toUpperCase();
  const id = trimmed.slice(dot + 1);
  if (!id) return { type: fallback, id: trimmed };
  return { type: PREFIX_TYPE[prefix] ?? fallback, id };
}

function addId(
  seen: Set<string>,
  out: ComboResourceRef[],
  raw: string | null | undefined,
  fallback: EntityType,
) {
  const resource = resourceFromReplayId(raw, fallback);
  if (resource) addResource(seen, out, resource);
}

function addChoice(
  seen: Set<string>,
  out: ComboResourceRef[],
  choice: ReplayChoice | undefined,
  fallback: EntityType,
) {
  if (!choice) return;
  const tableType = choice.locTable ? TABLE_TYPE[choice.locTable] : undefined;
  addId(seen, out, choice.locKey ?? choice.id, tableType ?? fallback);
}

function addStats(
  seen: Set<string>,
  out: ComboResourceRef[],
  stats: ReplayPlayerStats,
) {
  for (const card of stats.cards_gained ?? []) addId(seen, out, card.id, "card");
  for (const card of stats.cards_lost ?? []) addId(seen, out, card.id, "card");
  for (const card of stats.cards_removed ?? []) addId(seen, out, card.id, "card");
  for (const transform of stats.cards_transformed ?? []) {
    addId(seen, out, transform.original.id, "card");
    addId(seen, out, transform.final.id, "card");
  }
  for (const id of stats.upgraded_cards ?? []) addId(seen, out, id, "card");
  for (const id of stats.downgraded_cards ?? []) addId(seen, out, id, "card");
  for (const enchantment of stats.cards_enchanted ?? []) {
    addId(seen, out, enchantment.cardId, "card");
    addId(seen, out, enchantment.enchantmentId, "enchantment");
  }
  for (const choice of stats.card_choices ?? []) addChoice(seen, out, choice, "card");
  for (const choice of stats.relic_choices ?? []) addChoice(seen, out, choice, "relic");
  for (const choice of stats.potion_choices ?? []) addChoice(seen, out, choice, "potion");
  for (const id of stats.potion_used ?? []) addId(seen, out, id, "potion");
  for (const id of stats.potion_discarded ?? []) addId(seen, out, id, "potion");
  for (const choice of stats.event_choices ?? []) addChoice(seen, out, choice, "event");
  for (const choice of stats.ancient_choice ?? []) addChoice(seen, out, choice, "ancient");
  for (const id of stats.bought_relics ?? []) addId(seen, out, id, "relic");
  for (const id of stats.bought_potions ?? []) addId(seen, out, id, "potion");
  for (const id of stats.relics_removed ?? []) addId(seen, out, id, "relic");
}

function addHistoryEntry(
  seen: Set<string>,
  out: ComboResourceRef[],
  entry: ReplayHistoryEntry,
) {
  addStats(seen, out, entry);
  for (const stats of entry.player_stats ?? []) addStats(seen, out, stats);
  for (const room of entry.rooms ?? []) {
    if (!room.model_id) continue;
    if (room.model_id.startsWith("EVENT.")) {
      addId(seen, out, room.model_id, "event");
    } else if (room.model_id.startsWith("ANCIENT.")) {
      addId(seen, out, room.model_id, "ancient");
    } else {
      addId(seen, out, room.model_id, "encounter");
    }
  }
}

export function extractRunGameElements(run: ReplayRun): ComboResourceRef[] {
  const seen = new Set<string>();
  const out: ComboResourceRef[] = [];
  for (const player of run.players) {
    addId(seen, out, player.character, "character");
    for (const card of player.deck) {
      addId(seen, out, card.id, "card");
      if (card.enchantment?.id) addId(seen, out, card.enchantment.id, "enchantment");
    }
    for (const relic of player.relics) addId(seen, out, relic.id, "relic");
    for (const potion of player.potions) addId(seen, out, potion.id, "potion");
  }
  for (const modifier of run.modifiers) {
    addId(seen, out, modifier.id ?? modifier.name, "modifier");
  }
  for (const act of run.map_point_history) {
    for (const entry of act) addHistoryEntry(seen, out, entry);
  }
  return out;
}

function mergeResources(...lists: ComboResourceRef[][]): ComboResourceRef[] {
  const seen = new Set<string>();
  const out: ComboResourceRef[] = [];
  for (const list of lists) {
    for (const resource of list) addResource(seen, out, resource);
  }
  return out;
}

function resourcesFromCover(cover: CoverSpec | null | undefined): ComboResourceRef[] {
  if (!cover) return [];
  const seen = new Set<string>();
  const out: ComboResourceRef[] = [];
  for (const element of cover.elements) {
    addId(seen, out, element.id, element.kind);
  }
  if (cover.background.kind === "card-beta") {
    addId(seen, out, cover.background.cardId, "card");
  }
  return out;
}

function resourcesFromDonatedSummary(
  donated: DonatedRunSummary,
): ComboResourceRef[] {
  const seen = new Set<string>();
  const out: ComboResourceRef[] = [];
  for (const character of donated.characters ?? [donated.character]) {
    addId(seen, out, character, "character");
  }
  for (const resource of resourcesFromCover(donated.cover_spec)) {
    addResource(seen, out, resource);
  }
  if (donated.highlight_card) addId(seen, out, donated.highlight_card.id, "card");
  if (donated.highlight_relic) addId(seen, out, donated.highlight_relic.id, "relic");
  return out;
}

function addHaystackValue(parts: Set<string>, value: string | null | undefined) {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  parts.add(trimmed);
  parts.add(trimmed.toLowerCase());
}

function resourceFallbackNames(resource: ComboResourceRef): string[] {
  const names = [resource.id, prettifyId(resource.id)];
  if (resource.type === "character") {
    const replayId = resource.id.includes(".") ? resource.id : `CHARACTER.${resource.id}`;
    names.push(historyRunCharacterLabel(replayId, "ko"));
    names.push(historyRunCharacterLabel(replayId, "en"));
  }
  if (resource.type === "card") names.push(localize("cards", resource.id) ?? "");
  if (resource.type === "relic") names.push(localize("relics", resource.id) ?? "");
  if (resource.type === "potion") names.push(localize("potions", resource.id) ?? "");
  if (resource.type === "event") names.push(localize("events", resource.id) ?? "");
  if (resource.type === "encounter") names.push(localize("encounters", resource.id) ?? "");
  if (resource.type === "ancient") names.push(localize("ancients", resource.id) ?? "");
  if (resource.type === "enchantment") names.push(localize("enchantments", resource.id) ?? "");
  return names;
}

export function buildHistoryCourseSearchDoc(input: {
  runId: string;
  run?: ReplayRun | null;
  donated?: DonatedRunSummary | null;
  cover?: CoverSpec | null;
  noteBlocks?: PostBlock[] | null;
  entities?: EntityInfo[];
}): HistoryCourseSearchDoc {
  const run = input.run ?? null;
  const cover = input.cover
    ?? input.donated?.cover_spec
    ?? null;
  const noteBlocks = input.noteBlocks ?? input.donated?.note_blocks ?? null;
  const resources = mergeResources(
    run ? extractRunGameElements(run) : [],
    resourcesFromCover(cover),
    input.donated ? resourcesFromDonatedSummary(input.donated) : [],
  );

  const entityMap = new Map(
    (input.entities ?? []).map((entity) => [`${entity.type}:${entity.id}`, entity]),
  );
  const parts = new Set<string>();
  addHaystackValue(parts, input.runId);
  addHaystackValue(parts, run?.seed ?? input.donated?.seed);
  addHaystackValue(parts, run?.game_mode);
  const build = run?.build_id ?? input.donated?.build ?? "";
  for (const token of buildSearchTokens(build)) addHaystackValue(parts, token);
  const ascension = run?.ascension ?? input.donated?.ascension;
  if (typeof ascension === "number") {
    addHaystackValue(parts, `A${ascension}`);
    addHaystackValue(parts, `승천 ${ascension}`);
    addHaystackValue(parts, `Ascension ${ascension}`);
  }
  const win = run?.win ?? input.donated?.win;
  if (win) {
    addHaystackValue(parts, "클리어");
    addHaystackValue(parts, "승리");
    addHaystackValue(parts, "win");
    addHaystackValue(parts, "clear");
  } else if (win === false) {
    addHaystackValue(parts, "패배");
    addHaystackValue(parts, "loss");
    addHaystackValue(parts, "defeat");
  }
  const floors = run
    ? run.map_point_history.reduce((total, act) => total + act.length, 0)
    : input.donated?.total_floors;
  if (typeof floors === "number") {
    addHaystackValue(parts, `${floors}층`);
    addHaystackValue(parts, `floor ${floors}`);
  }
  const characters = run?.players.map((player) => player.character)
    ?? input.donated?.characters
    ?? (input.donated?.character ? [input.donated.character] : []);
  for (const character of characters) {
    addHaystackValue(parts, character);
    addHaystackValue(parts, historyRunCharacterLabel(character, "ko"));
    addHaystackValue(parts, historyRunCharacterLabel(character, "en"));
  }
  if (cover) {
    addHaystackValue(parts, cover.phrase);
    const meta = {
      win: Boolean(win),
      totalFloors: floors ?? 0,
      ascension: ascension ?? 0,
    };
    addHaystackValue(
      parts,
      resolveCoverPhrase(cover, meta, "ko", korTables as GameI18nTables),
    );
    addHaystackValue(
      parts,
      resolveCoverPhrase(cover, meta, "en", engTables as GameI18nTables),
    );
    for (const element of cover.elements) {
      addHaystackValue(parts, displayNameForCoverElement(element));
      addHaystackValue(parts, element.id);
    }
    if (run) {
      for (const phrase of coverPhrasePool(run, cover.elements)) {
        addHaystackValue(parts, phrase);
      }
    }
  }
  if (noteBlocks?.length) addHaystackValue(parts, blocksToPlainText(noteBlocks));
  if (input.donated?.highlight_card) {
    addHaystackValue(parts, input.donated.highlight_card.nameKo);
    addHaystackValue(parts, input.donated.highlight_card.nameEn);
  }
  if (input.donated?.highlight_relic) {
    addHaystackValue(parts, input.donated.highlight_relic.nameKo);
    addHaystackValue(parts, input.donated.highlight_relic.nameEn);
  }
  for (const resource of resources) {
    addHaystackValue(parts, resource.id);
    const entity = entityMap.get(comboResourceKey(resource));
    if (entity) {
      for (const name of entityDisplayNames(entity)) addHaystackValue(parts, name);
    } else {
      for (const name of resourceFallbackNames(resource)) addHaystackValue(parts, name);
    }
  }

  return {
    runId: input.runId,
    haystack: [...parts].join("\n").toLowerCase(),
    resources,
  };
}

export function historyCourseRunMatchesKeyword(
  doc: HistoryCourseSearchDoc,
  query: string,
  entities: EntityInfo[],
): boolean {
  const text = query.trim();
  if (!text) return true;
  if (doc.haystack.includes(text.toLowerCase())) return true;

  const entityMap = new Map(
    entities.map((entity) => [`${entity.type}:${entity.id}`, entity]),
  );
  const runEntities = doc.resources
    .map((resource) => entityMap.get(comboResourceKey(resource)))
    .filter((entity): entity is EntityInfo => Boolean(entity));
  return matchEntities(text, runEntities, 8).length > 0;
}

export function historyCourseRunMatches(
  doc: HistoryCourseSearchDoc,
  query: string,
  selected: ComboResourceRef[],
  entities: EntityInfo[],
): boolean {
  return historyCourseRunMatchesKeyword(doc, query, entities)
    && comboPostMatchesAnyGameElement(doc, selected);
}

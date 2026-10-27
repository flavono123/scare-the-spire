import { buildAllEntities } from "@/lib/all-entities";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import { getCardMaxUpgradeLevel, hasCardUpgrade, renderCardDescription } from "@/lib/codex-card-description";
import {
  getRelatedAfflictionIdsForKeyword,
  getRelatedAfflictionIdsForMonster,
  getRelatedAncientIdsForCard,
  getRelatedAncientIdsForEvent,
  getRelatedAncientIdsForPotion,
  getRelatedAncientIdsForRelic,
  getRelatedCardIdsForAncient,
  getRelatedCardIdsForEnchantment,
  getRelatedCardIdsForEvent,
  getRelatedCardIdsForKeyword,
  getRelatedCardIdsForMonster,
  getRelatedCardIdsForPotion,
  getRelatedCardIdsForPower,
  getRelatedCardIdsForRelic,
  getRelatedEnchantmentIdsForCard,
  getRelatedEnchantmentIdsForEvent,
  getRelatedEnchantmentIdsForKeyword,
  getRelatedEnchantmentIdsForPotion,
  getRelatedEnchantmentIdsForPower,
  getRelatedEnchantmentIdsForRelic,
  getRelatedEncounterIdsForMonster,
  getRelatedEventIdsForAncient,
  getRelatedEventIdsForCard,
  getRelatedEventIdsForEnchantment,
  getRelatedEventIdsForKeyword,
  getRelatedEventIdsForPotion,
  getRelatedEventIdsForPower,
  getRelatedEventIdsForRelic,
  getRelatedMonsterIdsForAffliction,
  getRelatedMonsterIdsForCard,
  getRelatedMonsterIdsForEncounter,
  getRelatedMonsterIdsForPower,
  getRelatedPotionIdsForAncient,
  getRelatedPotionIdsForCard,
  getRelatedPotionIdsForEnchantment,
  getRelatedPotionIdsForEvent,
  getRelatedPotionIdsForKeyword,
  getRelatedPotionIdsForPower,
  getRelatedPowerIdsForAffliction,
  getRelatedPowerIdsForCard,
  getRelatedPowerIdsForEnchantment,
  getRelatedPowerIdsForEvent,
  getRelatedPowerIdsForKeyword,
  getRelatedPowerIdsForMonster,
  getRelatedPowerIdsForPotion,
  getRelatedPowerIdsForRelic,
  getRelatedRelicIdsForAncient,
  getRelatedRelicIdsForCard,
  getRelatedRelicIdsForEnchantment,
  getRelatedRelicIdsForEvent,
  getRelatedRelicIdsForKeyword,
  getRelatedRelicIdsForPower,
} from "@/lib/codex-references";
import {
  formatTemplateCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexCard, CodexKeyword } from "@/lib/codex-types";
import type { CompendiumDataResources } from "@/lib/compendium-data-chunks";
import {
  getCharacterReferenceLabels,
  getDetailPatchHistoryLabels,
  getEpochUnlockLabels,
  relatedResourceLabel,
  type RelatedResourceKind,
} from "@/lib/compendium-detail-labels";
import { loadCompendiumDataResources } from "@/lib/compendium-data-chunks.server";
import type { CompendiumDetailResourceType } from "@/lib/compendium-detail-payload";
import {
  buildCompendiumResourceDetailHref,
  type CompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";
import { gameText, readGameLocalizationTable } from "@/lib/game-localization";
import { localizeHref, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { patchLineHref } from "@/lib/patch-line-links";
import { getSTS2PatchLines, getSTS2Patches, getSTS2Stories } from "@/lib/data";
import {
  buildResourcePatchIndex,
  findResourcePatchIndexResource,
  resourcePatchLines,
  type ResourcePatchIndexData,
} from "@/lib/resource-patch-index";
import { getPatchVersionLabel } from "@/lib/sts2-patch-labels";
import type { STS2Patch, STS2PatchLine, StoryEntityType } from "@/lib/types";

// Server-only: builds the crawlable text and links of a Compendium detail page.
// The interactive detail still loads its data on the client and replaces this
// content once it is ready.

export type StaticDetailLink = {
  href: string;
  label: string;
};

export type StaticDetailFact = {
  label: string;
  value: string;
  href?: string;
};

export type StaticDetailText = {
  /** Null for narrative text (story, dialogue, flavor), which the interactive detail shows unlabelled. */
  heading: string | null;
  /** BBCode-marked game text, rendered with RichText. */
  text: string;
};

export type StaticDetailLinkGroup = {
  heading: string;
  links: StaticDetailLink[];
};

export type StaticDetailHistoryLine = {
  id: string;
  date: string;
  versionLabel: string;
  href: string;
  segments: Array<string | StaticDetailLink>;
};

export type CompendiumStaticDetailModel = {
  /** Picks the page frame of the interactive detail that replaces this one. */
  kind: StaticDetailKind;
  kindLabel: string;
  title: string;
  altTitle: string | null;
  /** An Ancient's epithet, shown in quotes without a label like the interactive detail. */
  epithet: string | null;
  imageUrl: string | null;
  back: StaticDetailLink;
  facts: StaticDetailFact[];
  texts: StaticDetailText[];
  linkGroups: StaticDetailLinkGroup[];
  history: StaticDetailHistoryLine[];
  labels: {
    related: string;
    history: string;
    noHistory: string;
  };
};

export type StaticDetailKind = LinkKind;

type LinkKind = Extract<
  CompendiumResourceLinkType,
  | "affliction"
  | "ancient"
  | "card"
  | "character"
  | "enchantment"
  | "encounter"
  | "epoch"
  | "event"
  | "keyword"
  | "monster"
  | "potion"
  | "power"
  | "relic"
>;

// Hand-written labels for things the interactive details do not label and the
// game localization has no string for. Everything else comes from the
// interactive details' own label sources (compendium-detail-labels, service
// messages, gameUi) or from the game localization, so the static text does not
// change at hydration.
const STATIC_DETAIL_LABELS = {
  ko: {
    kinds: {
      affliction: "고난",
      ancient: "고대의 존재",
      card: "카드",
      character: "캐릭터",
      enchantment: "인챈트",
      encounter: "전투",
      epoch: "연대기",
      event: "이벤트",
      keyword: "키워드",
      monster: "몬스터",
      potion: "포션",
      power: "파워",
      relic: "유물",
    },
    keywords: "키워드",
    relatedSection: "관련 항목",
    starCost: "별 비용",
    type: "유형",
    character: "캐릭터",
    description: "효과",
    hpAscension: "체력 (승천)",
    act: "막",
    room: "방 유형",
    era: "시대",
    options: "선택지",
    cardPool: "카드",
  },
  en: {
    kinds: {
      affliction: "Affliction",
      ancient: "Ancient",
      card: "Card",
      character: "Character",
      enchantment: "Enchantment",
      encounter: "Encounter",
      epoch: "Epoch",
      event: "Event",
      keyword: "Keyword",
      monster: "Monster",
      potion: "Potion",
      power: "Power",
      relic: "Relic",
    },
    keywords: "Keywords",
    relatedSection: "Related",
    starCost: "Star cost",
    type: "Type",
    character: "Character",
    description: "Effect",
    hpAscension: "HP (Ascension)",
    act: "Act",
    room: "Room",
    era: "Era",
    options: "Options",
    cardPool: "Cards",
  },
} as const;

type Labels = (typeof STATIC_DETAIL_LABELS)[ServiceLocale];

/** Game strings for labels the interactive details do not show. */
type StaticGameLabels = {
  /** main_menu_ui HP_AMOUNT, the character select HP label (also the hydrated stage's HP aria label). */
  hp: string;
  /** main_menu_ui GOLD_AMOUNT, the character select gold label. */
  gold: string;
  /** static_hover_tips ENERGY.title. */
  energy: string;
  /** gameplay_ui RELIC_RARITY.STARTER. */
  starterRelic: string;
};

function amountLabel(template: string): string {
  return template.replace(/\s*[:：]?\s*\{amount\}\s*/i, "").trim();
}

const gameLabelsByLocale = new Map<GameLocale, Promise<StaticGameLabels>>();

function loadGameLabels(gameLocale: GameLocale): Promise<StaticGameLabels> {
  let promise = gameLabelsByLocale.get(gameLocale);
  if (!promise) {
    promise = Promise.all([
      readGameLocalizationTable(gameLocale, "main_menu_ui"),
      readGameLocalizationTable(gameLocale, "static_hover_tips"),
      readGameLocalizationTable(gameLocale, "gameplay_ui"),
    ]).then(([mainMenu, hoverTips, gameplay]) => ({
      hp: amountLabel(gameText(mainMenu, "HP_AMOUNT", "체력: {amount}")),
      gold: amountLabel(gameText(mainMenu, "GOLD_AMOUNT", "골드: {amount}")),
      energy: gameText(hoverTips, "ENERGY.title", "에너지"),
      starterRelic: gameText(gameplay, "RELIC_RARITY.STARTER", "시작 유물"),
    }));
    gameLabelsByLocale.set(gameLocale, promise);
  }
  return promise;
}

const STORY_TYPE_BY_LINK_KIND: Partial<Record<LinkKind, StoryEntityType>> = {
  affliction: "affliction",
  ancient: "ancient",
  card: "card",
  character: "character",
  enchantment: "enchantment",
  encounter: "encounter",
  epoch: "epoch",
  event: "event",
  monster: "monster",
  potion: "potion",
  power: "power",
  relic: "relic",
};

const EPOCH_ANCIENT_AFFILIATION_IDS: Record<string, string> = {
  darv: "DARV",
  neow: "NEOW",
  nonupeipe: "NONUPEIPE",
  orobas: "OROBAS",
  pael: "PAEL",
  tanx: "TANX",
  tezcatara: "TEZCATARA",
  vakuu: "VAKUU",
};

const resourcesByLocale = new Map<GameLocale, Promise<CompendiumDataResources>>();

function loadResources(gameLocale: GameLocale): Promise<CompendiumDataResources> {
  let promise = resourcesByLocale.get(gameLocale);
  if (!promise) {
    promise = loadCompendiumDataResources(gameLocale);
    resourcesByLocale.set(gameLocale, promise);
  }
  return promise;
}

let patchIndexPromise: Promise<ResourcePatchIndexData> | null = null;

// Built from data/ like scripts/generate-resource-patch-index.ts. Reading the
// generated copy under public/ would make Next trace all of public/ into
// every detail route.
function loadResourcePatchIndex(): Promise<ResourcePatchIndexData> {
  patchIndexPromise ??= Promise.all([
    getSTS2PatchLines(),
    getSTS2Patches(),
    loadResources("kor"),
    getSTS2Stories(),
  ]).then(([patchLines, patches, resources, stories]) => buildResourcePatchIndex({
    patchLines,
    patches,
    entities: buildAllEntities(resources),
    stories,
  }));
  return patchIndexPromise;
}

/** Index of every resource that has its own detail page, keyed by link kind. */
type DetailIndex = {
  resources: CompendiumDataResources;
  names: Map<string, string>;
};

function indexKey(kind: LinkKind, id: string): string {
  return `${kind}:${id.toUpperCase()}`;
}

function buildDetailIndex(resources: CompendiumDataResources): DetailIndex {
  const names = new Map<string, string>();
  const add = (kind: LinkKind, rows: readonly { id: string; name: string }[]) => {
    for (const row of rows) names.set(indexKey(kind, row.id), row.name);
  };
  add("affliction", resources.afflictions);
  add("ancient", resources.ancients);
  add("card", resources.cards);
  add("character", resources.characters);
  add("enchantment", resources.enchantments);
  add("encounter", resources.encounters);
  add("epoch", resources.epochs);
  add("event", resources.events);
  add("keyword", resources.keywords);
  add(
    "monster",
    resources.monsters.filter((monster) => monster.showInCompendium && isPublicBestiaryMonster(monster.id)),
  );
  add("potion", resources.potions);
  add("power", resources.powers);
  add("relic", resources.relics);
  return { resources, names };
}

const detailIndexes = new Map<GameLocale, Promise<DetailIndex>>();

function loadDetailIndex(gameLocale: GameLocale): Promise<DetailIndex> {
  let promise = detailIndexes.get(gameLocale);
  if (!promise) {
    promise = loadResources(gameLocale).then(buildDetailIndex);
    detailIndexes.set(gameLocale, promise);
  }
  return promise;
}

function normalizeGameResourceId(id: string): string {
  return id
    .trim()
    .split(/[.:/]/)
    .pop()!
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

class DetailContext {
  readonly labels: Labels;
  readonly serviceText: CodexServiceMessages;

  constructor(
    readonly index: DetailIndex,
    readonly serviceLocale: ServiceLocale,
    readonly gameLabels: StaticGameLabels,
  ) {
    this.labels = STATIC_DETAIL_LABELS[serviceLocale];
    this.serviceText = getCodexServiceMessages(serviceLocale);
  }

  get resources(): CompendiumDataResources {
    return this.index.resources;
  }

  href(kind: LinkKind, id: string): string {
    return localizeHref(buildCompendiumResourceDetailHref(kind, id), this.serviceLocale);
  }

  /** Resolves game ids such as "StrikeIronclad" to the Codex id with a detail page. */
  resolveId(kind: LinkKind, id: string): string | null {
    for (const candidate of [id, id.toUpperCase(), normalizeGameResourceId(id)]) {
      if (this.index.names.has(indexKey(kind, candidate))) return candidate.toUpperCase();
    }
    return null;
  }

  link(kind: LinkKind, id: string, label?: string): StaticDetailLink | null {
    const resolvedId = this.resolveId(kind, id);
    if (!resolvedId) return null;
    return {
      href: this.href(kind, resolvedId),
      label: label ?? this.index.names.get(indexKey(kind, resolvedId)) ?? id,
    };
  }

  links(kind: LinkKind, ids: readonly string[], excludeId?: string): StaticDetailLink[] {
    const seen = new Set<string>();
    const out: StaticDetailLink[] = [];
    for (const id of ids) {
      const resolvedId = this.resolveId(kind, id);
      if (!resolvedId || resolvedId === excludeId?.toUpperCase() || seen.has(resolvedId)) continue;
      seen.add(resolvedId);
      const link = this.link(kind, resolvedId);
      if (link) out.push(link);
    }
    return out;
  }

  related(kind: LinkKind & RelatedResourceKind, ids: readonly string[], excludeId?: string): StaticDetailLinkGroup {
    return {
      heading: relatedResourceLabel(kind, this.serviceLocale, this.resources.gameUi),
      links: this.links(kind, ids, excludeId),
    };
  }

  group(heading: string, kind: LinkKind, ids: readonly string[]): StaticDetailLinkGroup {
    return { heading, links: this.links(kind, ids) };
  }

  keywordGroup(matches: (keyword: CodexKeyword) => boolean): StaticDetailLinkGroup {
    return this.group(
      this.labels.keywords,
      "keyword",
      this.resources.keywords.filter(matches).map((keyword) => keyword.id),
    );
  }
}

function fact(label: string, value: string | number | null | undefined): StaticDetailFact[] {
  if (value === null || value === undefined || value === "") return [];
  return [{ label, value: String(value) }];
}

function text(heading: string | null, value: string | null | undefined): StaticDetailText[] {
  return value?.trim() ? [{ heading, text: value }] : [];
}

function hpRange(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  return max !== null && max !== min ? `${min}–${max}` : String(min);
}

/**
 * The character of a card, relic, or potion pool, linked to the character page.
 * Other pools (shared, colorless, curse, status, event, token, quest, ancient)
 * get no fact: they are not characters, and the game has no label for the
 * pool concept itself (card_library only has POOL_*_TIP filter tips).
 */
function poolFact(ctx: DetailContext, pool: string): StaticDetailFact[] {
  const characterLink = ctx.link("character", pool);
  if (!characterLink) return [];
  return [{ label: ctx.labels.character, value: characterLink.label, href: characterLink.href }];
}

function actLabel(ctx: DetailContext, act: string | null): string | null {
  if (!act) return null;
  return (ctx.resources.gameUi.acts as Record<string, string>)[act] || act;
}

function cardModel(ctx: DetailContext, card: CodexCard) {
  const { labels, resources } = ctx;
  const gameUi = resources.gameUi;
  const cost = card.isXCost ? "X" : card.cost >= 0 ? String(card.cost) : null;
  const upgraded = hasCardUpgrade(card) && getCardMaxUpgradeLevel(card) > 0
    ? renderCardDescription(card, { upgradeLevel: 1 })
    : null;

  return {
    kind: "card" as const,
    entity: card,
    imageUrl: card.imageUrl ?? card.betaImageUrl,
    facts: [
      ...fact(gameUi.cardLibrary.sort.cost, cost),
      ...fact(labels.starCost, card.isXStarCost ? "X" : card.starCost),
      ...fact(gameUi.cardLibrary.sort.type, card.typeLabel),
      ...fact(gameUi.common.rarity, card.rarityLabel),
      ...poolFact(ctx, card.color),
    ],
    texts: [
      ...text(labels.description, card.description),
      // The interactive card shows the upgraded text behind its "View Upgrades" toggle.
      ...(upgraded && upgraded !== card.description ? text(gameUi.cardLibrary.viewUpgrades, upgraded) : []),
    ],
    linkGroups: [
      ctx.keywordGroup((keyword) => getRelatedCardIdsForKeyword(keyword, [card]).length > 0),
      ctx.related("power", getRelatedPowerIdsForCard(card, resources.powers)),
      ctx.related("relic", getRelatedRelicIdsForCard(card.id)),
      ctx.related("potion", getRelatedPotionIdsForCard(card)),
      ctx.related("enchantment", getRelatedEnchantmentIdsForCard(card.id)),
      ctx.related("event", getRelatedEventIdsForCard(card.id)),
      ctx.related("ancient", getRelatedAncientIdsForCard(card, resources.ancients)),
      ctx.related("monster", getRelatedMonsterIdsForCard(card.id, resources.monsters)),
    ],
  };
}

type TypeModel = {
  kind: LinkKind;
  entity: { id: string; name: string; nameEn: string };
  imageUrl: string | null;
  epithet?: string | null;
  facts: StaticDetailFact[];
  texts: StaticDetailText[];
  linkGroups: StaticDetailLinkGroup[];
};

function findById<T extends { id: string }>(rows: readonly T[], id: string): T | undefined {
  const normalized = id.toLowerCase();
  return rows.find((row) => row.id.toLowerCase() === normalized);
}

function buildTypeModel(
  ctx: DetailContext,
  resourceType: CompendiumDetailResourceType,
  id: string,
): TypeModel | null {
  const { labels, resources } = ctx;
  const gameUi = resources.gameUi;

  switch (resourceType) {
    case "cards": {
      const card = findById(resources.cards, id);
      return card ? cardModel(ctx, card) : null;
    }
    case "relics": {
      const relic = findById(resources.relics, id);
      if (!relic) return null;
      return {
        kind: "relic",
        entity: relic,
        imageUrl: relic.imageUrl ?? relic.betaImageUrl,
        facts: [
          ...fact(gameUi.common.rarity, gameUi.relicCollection.rarities[relic.rarity]?.label),
          ...poolFact(ctx, relic.pool),
        ],
        texts: [
          ...text(labels.description, relic.description),
          ...text(null, relic.flavor),
        ],
        linkGroups: [
          ctx.keywordGroup((keyword) => getRelatedRelicIdsForKeyword(keyword, [relic]).length > 0),
          ctx.related("card", getRelatedCardIdsForRelic(relic.id)),
          ctx.related("power", getRelatedPowerIdsForRelic(relic, resources.powers)),
          ctx.related("enchantment", getRelatedEnchantmentIdsForRelic(relic, resources.enchantments)),
          ctx.related("event", getRelatedEventIdsForRelic(relic.id)),
          ctx.related("ancient", getRelatedAncientIdsForRelic(relic.id, resources.ancients)),
        ],
      };
    }
    case "potions": {
      const potion = findById(resources.potions, id);
      if (!potion) return null;
      return {
        kind: "potion",
        entity: potion,
        imageUrl: potion.imageUrl,
        facts: [
          ...fact(gameUi.common.rarity, gameUi.potionLab.rarities[potion.rarity]?.label),
          ...poolFact(ctx, potion.pool),
        ],
        texts: text(labels.description, potion.description),
        linkGroups: [
          ctx.keywordGroup((keyword) => getRelatedPotionIdsForKeyword(keyword, [potion]).length > 0),
          ctx.related("card", getRelatedCardIdsForPotion(potion.id, resources.cards)),
          ctx.related("power", getRelatedPowerIdsForPotion(potion, resources.powers)),
          ctx.related("enchantment", getRelatedEnchantmentIdsForPotion(potion.id)),
          ctx.related("event", getRelatedEventIdsForPotion(potion.id)),
          ctx.related("ancient", getRelatedAncientIdsForPotion(potion, resources.ancients)),
        ],
      };
    }
    case "powers": {
      const power = findById(resources.powers, id);
      if (!power) return null;
      return {
        kind: "power",
        entity: power,
        imageUrl: power.imageUrl ?? power.betaImageUrl,
        facts: fact(
          labels.type,
          gameUi.powers.types[power.type]?.label || ctx.serviceText.labels.powerTypes[power.type]?.label,
        ),
        texts: text(labels.description, power.description),
        linkGroups: [
          ctx.keywordGroup((keyword) => getRelatedPowerIdsForKeyword(keyword, [power]).length > 0),
          ctx.related("card", getRelatedCardIdsForPower(resources.cards, power.id)),
          ctx.related("relic", getRelatedRelicIdsForPower(resources.relics, power.id)),
          ctx.related("potion", getRelatedPotionIdsForPower(resources.potions, power.id)),
          ctx.related("enchantment", getRelatedEnchantmentIdsForPower(resources.enchantments, power.id)),
          ctx.related("monster", getRelatedMonsterIdsForPower(power.id, resources.monsters)),
          ctx.related("event", getRelatedEventIdsForPower(power.id, resources)),
        ],
      };
    }
    case "enchantments": {
      const enchantment = findById(resources.enchantments, id);
      if (enchantment) {
        return {
          kind: "enchantment",
          entity: enchantment,
          imageUrl: enchantment.imageUrl,
          facts: fact(
            gameUi.cardLibrary.sort.type,
            enchantment.cardType
              ? ctx.serviceText.labels.enchantmentCardTypes[enchantment.cardType].label
              : null,
          ),
          texts: text(labels.description, enchantment.description),
          linkGroups: [
            ctx.keywordGroup((keyword) => getRelatedEnchantmentIdsForKeyword(keyword, [enchantment]).length > 0),
            ctx.related("card", getRelatedCardIdsForEnchantment(enchantment.id)),
            ctx.related("relic", getRelatedRelicIdsForEnchantment(enchantment.id, resources.relics, resources.enchantments)),
            ctx.related("potion", getRelatedPotionIdsForEnchantment(enchantment.id)),
            ctx.related("power", getRelatedPowerIdsForEnchantment(enchantment, resources.powers)),
            ctx.related("event", getRelatedEventIdsForEnchantment(enchantment.id)),
          ],
        };
      }
      const affliction = findById(resources.afflictions, id);
      if (!affliction) return null;
      return {
        kind: "affliction",
        entity: affliction,
        imageUrl: affliction.imageUrl,
        facts: [],
        texts: text(labels.description, affliction.description),
        linkGroups: [
          ctx.keywordGroup((keyword) => getRelatedAfflictionIdsForKeyword(keyword, [affliction]).length > 0),
          ctx.related("power", getRelatedPowerIdsForAffliction(affliction)),
          ctx.related("monster", getRelatedMonsterIdsForAffliction(affliction.id, resources.monsters)),
        ],
      };
    }
    case "keywords": {
      const keyword = findById(resources.keywords, id);
      if (!keyword) return null;
      return {
        kind: "keyword",
        entity: keyword,
        imageUrl: keyword.imageUrl,
        facts: [],
        texts: text(labels.description, keyword.description),
        linkGroups: [
          ctx.related("card", getRelatedCardIdsForKeyword(keyword, resources.cards)),
          ctx.related("relic", getRelatedRelicIdsForKeyword(keyword, resources.relics)),
          ctx.related("potion", getRelatedPotionIdsForKeyword(keyword, resources.potions)),
          ctx.related("power", getRelatedPowerIdsForKeyword(keyword, resources.powers)),
          ctx.related("enchantment", getRelatedEnchantmentIdsForKeyword(keyword, resources.enchantments)),
          ctx.related("affliction", getRelatedAfflictionIdsForKeyword(keyword, resources.afflictions)),
          ctx.related("event", getRelatedEventIdsForKeyword(keyword, resources.events)),
        ],
      };
    }
    case "events": {
      const event = findById(resources.events, id);
      if (!event) return null;
      const acts = event.acts?.length ? event.acts : event.act ? [event.act] : [];
      const options = (event.options ?? [])
        .map((option) => `[gold]${option.title}[/gold]: ${option.description}`)
        .join("\n");
      return {
        kind: "event",
        entity: event,
        imageUrl: event.imageUrl,
        facts: fact(labels.act, acts.map((act) => actLabel(ctx, act)).filter(Boolean).join(", ")),
        texts: [
          ...text(null, event.description),
          ...text(labels.options, options),
        ],
        linkGroups: [
          ctx.keywordGroup((keyword) => getRelatedEventIdsForKeyword(keyword, [event]).length > 0),
          ctx.related("card", getRelatedCardIdsForEvent(event.id)),
          ctx.related("relic", getRelatedRelicIdsForEvent(event.id)),
          ctx.related("potion", getRelatedPotionIdsForEvent(event.id)),
          ctx.related("enchantment", getRelatedEnchantmentIdsForEvent(event.id)),
          ctx.related("power", getRelatedPowerIdsForEvent(event.id)),
          ctx.related("ancient", getRelatedAncientIdsForEvent(event, resources.ancients)),
        ],
      };
    }
    case "monsters": {
      const monster = resources.monsters.find((candidate) => (
        candidate.id.toLowerCase() === id.toLowerCase()
        && candidate.showInCompendium
        && isPublicBestiaryMonster(candidate.id)
      ));
      if (!monster) return null;
      const moves = (monster.bestiaryMoves.length ? monster.bestiaryMoves : monster.moves)
        .filter((move) => move.kind !== "animation")
        .map((move) => move.name)
        .filter((name, index, names) => name && names.indexOf(name) === index);
      return {
        kind: "monster",
        entity: monster,
        imageUrl: monster.bossImageUrl ?? monster.imageUrl,
        facts: [
          ...fact(labels.type, gameUi.monsterTypes[monster.type]?.label),
          ...fact(ctx.gameLabels.hp, hpRange(monster.minHp, monster.maxHp)),
          ...fact(labels.hpAscension, hpRange(monster.minHpAscension, monster.maxHpAscension)),
        ],
        texts: text(ctx.serviceText.monstersView.actionPreview, moves.join(", ")),
        linkGroups: [
          ctx.related("encounter", getRelatedEncounterIdsForMonster(monster.id, resources.encounters)),
          ctx.related("power", getRelatedPowerIdsForMonster(monster)),
          ctx.related("card", getRelatedCardIdsForMonster(monster)),
          ctx.related("affliction", getRelatedAfflictionIdsForMonster(monster)),
        ],
      };
    }
    case "encounters": {
      const encounter = findById(resources.encounters, id);
      if (!encounter) return null;
      return {
        kind: "encounter",
        entity: encounter,
        imageUrl: encounter.imageUrl,
        facts: [
          ...fact(labels.room, gameUi.encounterRoomTypes[encounter.roomType]),
          ...fact(labels.act, actLabel(ctx, encounter.act)),
        ],
        texts: [],
        linkGroups: [
          ctx.related("monster", getRelatedMonsterIdsForEncounter(encounter)),
        ],
      };
    }
    case "epochs": {
      const epoch = findById(resources.epochs, id);
      if (!epoch) return null;
      const era = epoch.eraName
        ? epoch.eraYear ? `${epoch.eraName} ${epoch.eraYear}` : epoch.eraName
        : epoch.eraGroup;
      return {
        kind: "epoch",
        entity: epoch,
        imageUrl: epoch.imageUrl ?? epoch.betaImageUrl,
        facts: fact(labels.era, era),
        texts: [
          ...text(null, epoch.description),
          ...text(
            getEpochUnlockLabels(ctx.serviceLocale).unlockInfo,
            ctx.serviceLocale === "ko" ? epoch.unlockInfo : epoch.unlockInfoEn,
          ),
        ],
        linkGroups: [
          ctx.related("card", epoch.unlocksCards),
          ctx.related("relic", epoch.unlocksRelics),
          ctx.related("potion", epoch.unlocksPotions),
          ctx.related("epoch", epoch.expandsTimeline),
          ctx.related(
            "ancient",
            epoch.affiliations.flatMap((affiliation) => EPOCH_ANCIENT_AFFILIATION_IDS[affiliation] ?? []),
          ),
        ],
      };
    }
    case "ancients": {
      const ancient = findById(resources.ancients, id);
      if (!ancient) return null;
      return {
        kind: "ancient",
        entity: ancient,
        imageUrl: ancient.imageUrl,
        epithet: ancient.epithet || null,
        facts: fact(labels.act, actLabel(ctx, ancient.act)),
        texts: text(null, ancient.description),
        linkGroups: [
          // Headed like the interactive detail's relic count pill.
          ctx.group(
            formatTemplateCount(ctx.serviceText.ancientsView.relicCount, ancient.relicIds.length),
            "relic",
            getRelatedRelicIdsForAncient(ancient),
          ),
          ctx.related("card", getRelatedCardIdsForAncient(ancient, resources.cards)),
          ctx.related("potion", getRelatedPotionIdsForAncient(ancient, resources.potions)),
          ctx.related("event", getRelatedEventIdsForAncient(ancient, resources.events)),
        ],
      };
    }
    case "characters": {
      const character = findById(resources.characters, id);
      if (!character) return null;
      const colorKey = character.id.toLowerCase();
      const characterLabels = getCharacterReferenceLabels(ctx.serviceLocale);
      return {
        kind: "character",
        entity: character,
        imageUrl: character.iconUrl || character.imageUrl,
        facts: [
          ...fact(ctx.gameLabels.hp, character.startingHp),
          ...fact(ctx.gameLabels.gold, character.startingGold),
          ...fact(ctx.gameLabels.energy, character.maxEnergy),
        ],
        texts: text(null, character.description),
        linkGroups: [
          ctx.group(characterLabels.startingCards, "card", character.startingDeckIds),
          ctx.group(ctx.gameLabels.starterRelic, "relic", character.startingRelicIds),
          ctx.group(
            labels.cardPool,
            "card",
            resources.cards.filter((card) => card.color === colorKey).map((card) => card.id),
          ),
          ctx.group(
            characterLabels.relics,
            "relic",
            resources.relics.filter((relic) => relic.pool === colorKey).map((relic) => relic.id),
          ),
          ctx.group(
            characterLabels.potions,
            "potion",
            resources.potions.filter((potion) => potion.pool === colorKey).map((potion) => potion.id),
          ),
        ],
      };
    }
  }
}

function patchForLine(patches: readonly STS2Patch[], line: STS2PatchLine): STS2Patch | undefined {
  return patches.find((patch) =>
    patch.id === line.patch
    || patch.version === line.version
    || `v${patch.version}` === line.patch,
  );
}

function dateLabel(date: string, serviceLocale: ServiceLocale): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return serviceLocale === "ko" ? `${year}.${month}.${day}` : `${year}-${month}-${day}`;
}

function linkKindForRef(type: string): LinkKind | null {
  switch (type) {
    case "affliction":
    case "ancient":
    case "card":
    case "character":
    case "enchantment":
    case "encounter":
    case "epoch":
    case "event":
    case "keyword":
    case "monster":
    case "potion":
    case "power":
    case "relic":
      return type;
    default:
      return null;
  }
}

/** Splits a patch line into text and links to the resources it mentions. */
function historySegments(
  ctx: DetailContext,
  line: STS2PatchLine,
  selfKey: string,
): Array<string | StaticDetailLink> {
  const value = ctx.serviceLocale === "ko" ? line.textKo : line.textEn ?? line.textKo;
  let segments: Array<string | StaticDetailLink> = [value];

  for (const ref of line.entityRefs ?? []) {
    const kind = linkKindForRef(ref.type);
    if (!kind || indexKey(kind, ref.id) === selfKey) continue;
    const link = ctx.link(kind, ref.id);
    if (!link) continue;
    const label = [ref.label, link.label].find((candidate) => (
      candidate && segments.some((segment) => typeof segment === "string" && segment.includes(candidate))
    ));
    if (!label) continue;

    let replaced = false;
    segments = segments.flatMap((segment) => {
      if (replaced || typeof segment !== "string") return [segment];
      const at = segment.indexOf(label);
      if (at < 0) return [segment];
      replaced = true;
      return [
        segment.slice(0, at),
        { href: link.href, label },
        segment.slice(at + label.length),
      ].filter((part) => part !== "");
    });
  }

  return segments;
}

async function buildHistory(
  ctx: DetailContext,
  kind: LinkKind,
  id: string,
): Promise<StaticDetailHistoryLine[]> {
  const storyType = STORY_TYPE_BY_LINK_KIND[kind];
  if (!storyType) return [];
  const data = await loadResourcePatchIndex();
  const resource = findResourcePatchIndexResource(data, storyType, id);
  if (!resource) return [];

  const selfKey = indexKey(kind, id);
  return resourcePatchLines(data, resource).map((line) => {
    const patch = patchForLine(data.patches, line);
    return {
      id: line.id,
      date: dateLabel(line.date, ctx.serviceLocale),
      versionLabel: patch ? getPatchVersionLabel(patch, ctx.serviceLocale) : line.patch,
      href: localizeHref(patchLineHref(line), ctx.serviceLocale),
      segments: historySegments(ctx, line, selfKey),
    };
  });
}

const LIST_PATHS: Record<LinkKind, string> = {
  affliction: "/compendium/enchantments",
  ancient: "/compendium/ancients",
  card: "/compendium/cards",
  character: "/compendium/characters",
  enchantment: "/compendium/enchantments",
  encounter: "/compendium/bestiary?view=encounters",
  epoch: "/compendium/epochs",
  event: "/compendium/events",
  keyword: "/compendium/keywords",
  monster: "/compendium/bestiary",
  potion: "/compendium/potions",
  power: "/compendium/powers",
  relic: "/compendium/relics",
};

/** The back link label, as each interactive detail labels its list link. */
function listTitle(ctx: DetailContext, kind: LinkKind): string {
  const gameUi = ctx.resources.gameUi;
  const serviceText = ctx.serviceText;
  switch (kind) {
    case "card":
      return gameUi.cardLibraryTitle;
    case "relic":
      return gameUi.relicCollectionTitle;
    case "potion":
      return gameUi.potionLabTitle;
    case "power":
      return gameUi.nav.powers;
    case "keyword":
      return gameUi.nav.keywords;
    case "monster":
      return gameUi.bestiaryTitle;
    case "encounter":
      return serviceText.encountersView.backToList;
    case "event":
      return serviceText.eventsView.backToList;
    case "ancient":
      return gameUi.ancientsTitle;
    case "epoch":
      return gameUi.epochsTitle;
    case "character":
      return gameUi.charactersTitle;
    case "enchantment":
    case "affliction":
      return serviceText.enchantmentsView.title;
  }
}

/** The kind label above the title; the pill text where the interactive detail shows one. */
function kindLabel(ctx: DetailContext, kind: LinkKind): string {
  const gameUi = ctx.resources.gameUi;
  switch (kind) {
    case "ancient":
      return gameUi.ancientsTitle;
    case "epoch":
      return gameUi.epochsTitle;
    case "affliction":
      return ctx.serviceText.afflictions;
    default:
      return ctx.labels.kinds[kind];
  }
}

export async function buildCompendiumStaticDetail(
  resourceType: CompendiumDetailResourceType,
  id: string,
  locale: { serviceLocale: ServiceLocale; gameLocale: GameLocale },
): Promise<CompendiumStaticDetailModel | null> {
  const [index, gameLabels] = await Promise.all([
    loadDetailIndex(locale.gameLocale),
    loadGameLabels(locale.gameLocale),
  ]);
  const ctx = new DetailContext(index, locale.serviceLocale, gameLabels);
  const model = buildTypeModel(ctx, resourceType, id);
  if (!model) return null;

  const historyLabels = getDetailPatchHistoryLabels(locale.serviceLocale);
  return {
    kind: model.kind,
    kindLabel: kindLabel(ctx, model.kind),
    title: model.entity.name,
    altTitle: model.entity.nameEn && model.entity.nameEn !== model.entity.name ? model.entity.nameEn : null,
    epithet: model.epithet ?? null,
    imageUrl: model.imageUrl,
    back: {
      href: localizeHref(LIST_PATHS[model.kind], locale.serviceLocale),
      label: listTitle(ctx, model.kind),
    },
    facts: model.facts,
    texts: model.texts,
    linkGroups: model.linkGroups.filter((group) => group.links.length > 0),
    history: await buildHistory(ctx, model.kind, model.entity.id),
    labels: {
      related: ctx.labels.relatedSection,
      history: historyLabels.patchHistory,
      noHistory: historyLabels.noPatchHistory,
    },
  };
}

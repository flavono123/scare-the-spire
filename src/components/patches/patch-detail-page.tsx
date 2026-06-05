import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import type { Metadata } from "next";
import fs from "fs/promises";
import path from "path";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Patches } from "@/lib/data";
import { getCodexCards, getCodexRelics, getCodexPotions, getCodexPowers, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexEncounters, getCodexAncients, getCodexEpochs } from "@/lib/codex-data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { readGameLocalizationTable, type GameLocalizationTable } from "@/lib/game-localization";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import {
  PatchNoteRenderer,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import { DeferredCommentSection } from "@/components/patches/deferred-comment-section";
import { buildPatchCommentThreadKey } from "@/lib/comment-threads";
import {
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { getPatchVersionLabel } from "@/lib/sts2-patch-labels";
import { resolvePatchArt, type ResolvedPatchArt } from "@/lib/sts2-patch-art";
import type { PatchType } from "@/lib/types";
import type { CodexMonster, DamageValue, MonsterActionType, MonsterMove } from "@/lib/codex-types";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";

const PATCH_COPY: Record<ServiceLocale, {
  backToList: string;
  steamOriginal: string;
  missing: string;
  buildingBadge: string;
  buildingTitle: string;
  buildingBody: string;
  comments: string;
  types: Record<PatchType, string>;
}> = {
  ko: {
    backToList: "패치 목록",
    steamOriginal: "Steam 원문",
    missing: "패치 노트 원문이 아직 준비되지 않았습니다.",
    buildingBadge: "작성 중",
    buildingTitle: "슬서운변경을 만드는 중입니다.",
    buildingBody: "Steam 패치는 공개됐고, 이 페이지에는 번역·링크·툴팁 검수가 끝난 rich 패치노트를 게시합니다.",
    comments: "댓글",
    types: {
      release: "출시",
      beta: "베타",
      stable: "안정",
      hotfix: "핫픽스",
    },
  },
  en: {
    backToList: "Patch list",
    steamOriginal: "Steam original",
    missing: "Patch notes are not ready yet.",
    buildingBadge: "Building",
    buildingTitle: "Rich patch notes are being prepared.",
    buildingBody: "The Steam patch is live; this page will show the enriched translation after link and tooltip review.",
    comments: "Comments",
    types: {
      release: "Release",
      beta: "Beta",
      stable: "Stable",
      hotfix: "Hotfix",
    },
  },
};

const PATCH_TYPE_CLASSES: Record<PatchType, string> = {
  release: "bg-green-500/15 text-green-400 border-green-500/30",
  beta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  stable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hotfix: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function PatchArtHero({ art }: { art: ResolvedPatchArt }) {
  return (
    <div className="mt-6 aspect-[16/7] overflow-hidden rounded-lg border border-border/70 bg-zinc-950">
      <Image
        src={art.imageUrl}
        alt={art.alt}
        width={1120}
        height={490}
        className="h-full w-full object-cover"
        style={{ objectPosition: art.objectPosition }}
      />
    </div>
  );
}

const NOTES_DIR = path.join(process.cwd(), "data/sts2-patch-notes");
const PATCH_OG_DESCRIPTION_MAX_LENGTH = 200;

function truncateOgDescription(text: string, maxLength = PATCH_OG_DESCRIPTION_MAX_LENGTH): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function plainPatchMarkdownForOg(markdown: string, serviceLocale: ServiceLocale): string {
  const localeFiltered = serviceLocale === "ko"
    ? markdown.replace(/\[devnote:en\][\s\S]*?\[\/devnote\]/gi, " ")
    : markdown;

  const withoutStructuralLines = localeFiltered
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^[-*+]\s+/, ""))
    .join(" ");

  return withoutStructuralLines
    .replace(/\[devnote(?::en)?\]([\s\S]*?)\[\/devnote\]/gi, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[\/?[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)?(?:=[^\]]+)?\]/gi, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readPatchOgDescription({
  version,
  serviceLocale,
  fallback,
}: {
  version: string;
  serviceLocale: ServiceLocale;
  fallback: string;
}): Promise<string> {
  const markdownPath = path.join(
    NOTES_DIR,
    serviceLocale === "ko" ? `v${version}.ko.md` : `v${version}.md`,
  );
  const markdown = await fs.readFile(markdownPath, "utf-8").catch(() => null);
  const description = markdown ? plainPatchMarkdownForOg(markdown, serviceLocale) : "";
  return truncateOgDescription(description || fallback);
}

const PATCH_ENTITY_ALIASES_EN: Record<string, string[]> = {
  AXEBOTS_NORMAL: ["Axebots"],
  ASSASSIN_RUBY_RAIDER: ["Ruby Raider Assassin"],
  GREMLIN_MERC: ["Gremlin Mercenary"],
};

const PATCH_EPOCH_LABEL_OVERRIDES: Record<string, {
  nameKo: string;
  nameEn: string;
  aliasesKo?: string[];
  aliasesEn?: string[];
}> = {
  REGENT5_EPOCH: {
    nameKo: "우정",
    nameEn: "Friendship",
    aliasesKo: ["친구"],
    aliasesEn: ["Friends"],
  },
};

const CHARACTER_HEADING_COLORS = {
  IRONCLAD: "red",
  SILENT: "green",
  REGENT: "orange",
  NECROBINDER: "pink",
  DEFECT: "aqua",
} as const;

function ancientRelicAliases(ownerName: string, relicName: string): string[] {
  if (!ownerName || !relicName) return [];
  if (relicName.toLowerCase().startsWith(`${ownerName.toLowerCase()}'s `)) {
    return [];
  }
  return [`${ownerName}'s ${relicName}`];
}

function patchLabelKey(text: string): string {
  return text
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripGameMarkup(text: string | undefined): string {
  return (text ?? "")
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSentencePunctuation(text: string | undefined): string {
  return stripGameMarkup(text).replace(/[.。]+$/g, "").trim();
}

function punctuationRelaxedAliases(text: string | undefined): string[] {
  const stripped = stripGameMarkup(text);
  const noComma = stripped.replace(/\s*,\s*/g, " ").replace(/\s+/g, " ").trim();
  return noComma && noComma !== stripped ? [noComma] : [];
}

function patchDisplayName(
  selectedName: string,
  englishName: string,
  gameLocale: GameLocale,
): string {
  if (gameLocale !== "kor" && /[가-힣]/.test(selectedName)) return englishName;
  return selectedName;
}

function colorTag(color: string, label: string): string {
  return `[${color}]${label}[/${color}]`;
}

function stripPlaceholderLabel(source: string | undefined, placeholder: string): string {
  return stripGameMarkup(source)
    .replace(placeholder, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addPatchHeadingLabel(
  labels: Record<string, string>,
  source: string | undefined,
  target: string | undefined,
) {
  if (!source || !target) return;
  const key = patchLabelKey(source);
  if (!key) return;
  labels[key] = target;
}

function englishTitleAliases(source: string | undefined): string[] {
  if (!source) return [];
  const trimmed = source.trim();
  const withoutArticle = trimmed.replace(/^the\s+/i, "").trim();
  return withoutArticle && withoutArticle !== trimmed ? [trimmed, withoutArticle] : [trimmed];
}

function isTitleLocalizationKey(key: string): boolean {
  return key.endsWith(".title") || key.endsWith(".name") || key.endsWith("Title");
}

function addPatchKeywordLabel(
  labels: Record<string, string>,
  sourceLabel: string | undefined,
  targetLabel: string | undefined,
) {
  if (!sourceLabel || !targetLabel) return;
  labels[patchLabelKey(sourceLabel)] = targetLabel;
  for (const alias of punctuationRelaxedAliases(sourceLabel)) {
    labels[patchLabelKey(alias)] = targetLabel;
  }
}

function addPatchKeywordLabels(
  labels: Record<string, string>,
  source: GameLocalizationTable,
  target: GameLocalizationTable,
) {
  for (const [key, sourceLabel] of Object.entries(source)) {
    if (!isTitleLocalizationKey(key)) continue;
    const targetLabel = target[key];
    if (!targetLabel) continue;
    addPatchKeywordLabel(labels, sourceLabel, targetLabel);
  }
}

function normalizedPatchSearchText(markdown: string): string {
  return markdown
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, " ")
    .replace(/\*\*/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patchTextIncludesLabel(searchText: string, label: string | undefined): boolean {
  const normalized = label?.trim().toLowerCase();
  if (!normalized || Array.from(normalized).length < 2) return false;

  if (/^[a-z0-9][a-z0-9\s'&:.,!?-]*$/i.test(normalized)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalized)}(?=$|[^a-z0-9])`, "i").test(searchText);
  }

  return searchText.includes(normalized);
}

function addExplicitPatchTagLabel(
  labelsByType: Map<EntityInfo["type"], Set<string>>,
  type: string,
  label: string,
) {
  const normalized = stripGameMarkup(label).toLowerCase();
  if (!normalized) return;

  const entityType = type as EntityInfo["type"];
  const labels = labelsByType.get(entityType);
  if (labels) labels.add(normalized);
  else labelsByType.set(entityType, new Set([normalized]));
}

function explicitPatchTagLabels(markdown: string): Map<EntityInfo["type"], Set<string>> {
  const labelsByType = new Map<EntityInfo["type"], Set<string>>();
  const tagRe = /\[gold:([a-z]+)\]([\s\S]*?)\[\/gold\]/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(markdown)) !== null) {
    addExplicitPatchTagLabel(labelsByType, match[1], match[2]);
  }

  return labelsByType;
}

function patchEntityIsExplicitlyTagged(
  labelsByType: Map<EntityInfo["type"], Set<string>>,
  entity: EntityInfo,
): boolean {
  const labels = labelsByType.get(entity.type);
  if (!labels) return false;

  return [
    entity.nameEn,
    entity.nameKo,
    ...(entity.aliasesEn ?? []),
    ...(entity.aliasesKo ?? []),
  ].some((label) => labels.has(stripGameMarkup(label).toLowerCase()));
}

function filterPatchNoteEntities(markdown: string, entities: EntityInfo[]): EntityInfo[] {
  const searchText = normalizedPatchSearchText(markdown);
  const explicitlyTaggedLabels = explicitPatchTagLabels(markdown);
  return entities.filter((entity) => {
    if (patchEntityIsExplicitlyTagged(explicitlyTaggedLabels, entity)) return true;

    const labels = [
      entity.nameEn,
      entity.nameKo,
      ...(entity.aliasesEn ?? []),
      ...(entity.aliasesKo ?? []),
    ];
    return labels.some((label) => patchTextIncludesLabel(searchText, label));
  });
}

type PatchMonsterMoveOverride = {
  monsterId: string;
  id: string;
  nameKo: string;
  nameEn: string;
  actionTypes: MonsterActionType[];
  intents: string[];
  damageKey?: string;
  damage?: DamageValue;
  repeat?: DamageValue;
  aliasesKo?: string[];
  aliasesEn?: string[];
};

const PATCH_MONSTER_MOVE_ALIASES_KO: Record<string, Record<string, string[]>> = {
  HAUNTED_SHIP: {
    STOMP: ["짓밟기"],
  },
};

const PATCH_REMOVED_MONSTER_MOVES: Record<string, PatchMonsterMoveOverride[]> = {
  "0.106.0": [
    {
      monsterId: "HAUNTED_SHIP",
      id: "RAMMING_SPEED",
      nameKo: "전속력",
      nameEn: "Ramming Speed",
      actionTypes: ["attack"],
      intents: ["SingleAttackIntent"],
      damageKey: "RammingSpeed",
      damage: { normal: 10, ascension: 11 },
      repeat: { normal: 1, ascension: null },
    },
    {
      monsterId: "SKULKING_COLONY",
      id: "SMASH",
      nameKo: "강타",
      nameEn: "Smash",
      actionTypes: ["attack"],
      intents: ["SingleAttackIntent"],
      damageKey: "Smash",
      damage: { normal: 12, ascension: 13 },
      repeat: { normal: 1, ascension: null },
    },
  ],
};

function buildPatchMonsterMoveEntities(
  monsters: CodexMonster[],
  patchVersion: string,
  gameLocale: GameLocale,
): EntityInfo[] {
  const entities: EntityInfo[] = [];
  const seen = new Set<string>();

  for (const monster of monsters) {
    for (const move of [...monster.bestiaryMoves, ...monster.moves]) {
      if (["NOTHING", "SPAWNED", "DEAD"].includes(move.id)) continue;
      const key = `${monster.id}:${move.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entities.push(buildMonsterMoveEntity(monster, move, gameLocale, {
        aliasesKo: PATCH_MONSTER_MOVE_ALIASES_KO[monster.id]?.[move.id],
      }));
    }
  }

  for (const override of PATCH_REMOVED_MONSTER_MOVES[patchVersion] ?? []) {
    const monster = monsters.find((candidate) => candidate.id === override.monsterId);
    if (!monster) continue;
    const move = buildRemovedMonsterMove(override);
    entities.push(buildMonsterMoveEntity(monster, move, gameLocale, {
      aliasesKo: override.aliasesKo,
      aliasesEn: override.aliasesEn,
      damage: override.damage,
    }));
  }

  return entities;
}

function buildMonsterMoveEntity(
  monster: CodexMonster,
  move: MonsterMove,
  gameLocale: GameLocale,
  options: {
    aliasesKo?: string[];
    aliasesEn?: string[];
    damage?: DamageValue;
    block?: DamageValue;
  } = {},
): EntityInfo {
  return {
    id: `${monster.id}__MOVE__${move.id}`,
    nameEn: move.nameEn,
    nameKo: patchDisplayName(move.name, move.nameEn, gameLocale),
    aliasesKo: options.aliasesKo,
    aliasesEn: options.aliasesEn,
    imageUrl: monster.bossImageUrl ?? monster.imageUrl,
    href: `/compendium/bestiary?monster=${monster.id.toLowerCase()}`,
    color: monster.type,
    type: "monsterMove",
    monsterMoveData: move,
    monsterMoveMonsterData: monster,
    monsterMoveDamageValue: options.damage,
    monsterMoveBlockValue: options.block,
  };
}

function buildRemovedMonsterMove(override: PatchMonsterMoveOverride): MonsterMove {
  return {
    id: override.id,
    name: override.nameKo,
    nameEn: override.nameEn,
    kind: "move",
    actionTypes: override.actionTypes,
    intents: override.intents,
    intentDetails: override.intents.map((type) => ({
      type,
      damageKey: override.damageKey,
      repeat: override.repeat,
    })),
    powerApplications: [],
    cardApplications: [],
  };
}

async function getPatchGameKeywordLabels(gameLocale: GameLocale): Promise<Record<string, string>> {
  const tableNames = [
    "badges",
    "modifiers",
    "cards",
    "relics",
    "potions",
    "powers",
    "enchantments",
    "events",
    "monsters",
    "encounters",
    "ancients",
    "epochs",
  ];
  const [engTables, korTables, gameTables] = await Promise.all([
    Promise.all(tableNames.map((tableName) => readGameLocalizationTable("eng", tableName))),
    Promise.all(tableNames.map((tableName) => readGameLocalizationTable("kor", tableName))),
    Promise.all(tableNames.map((tableName) => readGameLocalizationTable(gameLocale, tableName))),
  ]);
  const labels: Record<string, string> = {};
  for (let i = 0; i < tableNames.length; i++) {
    addPatchKeywordLabels(labels, engTables[i], gameTables[i]);
    addPatchKeywordLabels(labels, korTables[i], gameTables[i]);
  }

  const badgeIndex = tableNames.indexOf("badges");
  addPatchKeywordLabel(
    labels,
    `The ${engTables[badgeIndex]["PERFECT.goldTitle"]}`,
    gameTables[badgeIndex]["PERFECT.goldTitle"],
  );
  return labels;
}

async function getPatchGameHeadingLabels(gameLocale: GameLocale): Promise<Record<string, string>> {
  const [
    engCharacters,
    korCharacters,
    gameCharacters,
    engMap,
    korMap,
    gameMap,
    engHoverTips,
    korHoverTips,
    gameHoverTips,
    engEpochs,
    korEpochs,
    gameEpochs,
    engAncients,
    korAncients,
    gameAncients,
    engGameplay,
    korGameplay,
    gameGameplay,
    engMainMenu,
    korMainMenu,
    gameMainMenu,
    engCardLibrary,
    korCardLibrary,
    gameCardLibrary,
  ] = await Promise.all([
    readGameLocalizationTable("eng", "characters"),
    readGameLocalizationTable("kor", "characters"),
    readGameLocalizationTable(gameLocale, "characters"),
    readGameLocalizationTable("eng", "map"),
    readGameLocalizationTable("kor", "map"),
    readGameLocalizationTable(gameLocale, "map"),
    readGameLocalizationTable("eng", "static_hover_tips"),
    readGameLocalizationTable("kor", "static_hover_tips"),
    readGameLocalizationTable(gameLocale, "static_hover_tips"),
    readGameLocalizationTable("eng", "epochs"),
    readGameLocalizationTable("kor", "epochs"),
    readGameLocalizationTable(gameLocale, "epochs"),
    readGameLocalizationTable("eng", "ancients"),
    readGameLocalizationTable("kor", "ancients"),
    readGameLocalizationTable(gameLocale, "ancients"),
    readGameLocalizationTable("eng", "gameplay_ui"),
    readGameLocalizationTable("kor", "gameplay_ui"),
    readGameLocalizationTable(gameLocale, "gameplay_ui"),
    readGameLocalizationTable("eng", "main_menu_ui"),
    readGameLocalizationTable("kor", "main_menu_ui"),
    readGameLocalizationTable(gameLocale, "main_menu_ui"),
    readGameLocalizationTable("eng", "card_library"),
    readGameLocalizationTable("kor", "card_library"),
    readGameLocalizationTable(gameLocale, "card_library"),
  ]);

  const labels: Record<string, string> = {};

  for (const [characterId, color] of Object.entries(CHARACTER_HEADING_COLORS)) {
    const target = gameCharacters[`${characterId}.title`];
    if (!target) continue;

    const coloredTarget = colorTag(color, target);
    for (const source of [
      ...englishTitleAliases(engCharacters[`${characterId}.title`]),
      korCharacters[`${characterId}.title`],
    ]) {
      addPatchHeadingLabel(labels, source, coloredTarget);
      addPatchHeadingLabel(labels, `Card Changes - ${source}`, `Card Changes - ${coloredTarget}`);
      addPatchHeadingLabel(labels, `카드 변경 - ${source}`, `카드 변경 - ${coloredTarget}`);
    }
  }

  const enemyPluralTarget = gameMap["LEGEND_ENEMY.hoverTip.title"];
  const enemySingularTarget = gameMap["LEGEND_ENEMY.title"];
  const ascensionTarget = stripPlaceholderLabel(gameGameplay["ASCENSION_LEVEL"], "{ascension}");
  const enemyAscensionTargetEn = [enemySingularTarget, ascensionTarget].filter(Boolean).join(" / ");
  const enemyAscensionTargetKo = enemyAscensionTargetEn;
  for (const source of [
    engMap["LEGEND_ENEMY.title"],
    "Enemy",
  ]) {
    addPatchHeadingLabel(labels, `Enemy / Ascension Changes`, `${enemyAscensionTargetEn} Changes`);
    addPatchHeadingLabel(labels, `적 / 승천 변경`, `${enemyAscensionTargetKo} 변경`);
    addPatchHeadingLabel(labels, source, enemySingularTarget);
  }
  for (const source of [
    engMap["LEGEND_ENEMY.hoverTip.title"],
    korMap["LEGEND_ENEMY.hoverTip.title"],
    korMap["LEGEND_ENEMY.title"],
    "Enemies",
    "적",
  ]) {
    addPatchHeadingLabel(labels, source, enemyPluralTarget);
  }

  const eventTarget = gameHoverTips["ROOM_EVENT.title"] ?? gameMap["LEGEND_EVENT.hoverTip.title"];
  for (const source of [
    engHoverTips["ROOM_EVENT.title"],
    engMap["LEGEND_EVENT.hoverTip.title"],
    "Event",
  ]) {
    addPatchHeadingLabel(labels, source, eventTarget);
  }
  const eventsHeadingTarget = gameLocale === "eng" ? "Events" : eventTarget;
  for (const source of [
    korHoverTips["ROOM_EVENT.title"],
    korMap["LEGEND_EVENT.hoverTip.title"],
    "Events",
    "이벤트",
  ]) {
    addPatchHeadingLabel(labels, source, eventsHeadingTarget);
  }

  const ancientTarget = gameEpochs["RELIC2_EPOCH.title"] ?? gameHoverTips["ROOM_ANCIENT.title"];
  const coloredAncientTarget = ancientTarget ? colorTag("blue", ancientTarget) : undefined;
  for (const source of [
    engEpochs["RELIC2_EPOCH.title"],
    korEpochs["RELIC2_EPOCH.title"],
    engHoverTips["ROOM_ANCIENT.title"],
    korHoverTips["ROOM_ANCIENT.title"],
    "Ancient",
    "Ancients",
    "고대의 존재",
  ]) {
    addPatchHeadingLabel(labels, source, coloredAncientTarget);
  }

  const neowTarget = gameEpochs["NEOW_EPOCH.title"] ?? gameAncients["NEOW.title"];
  if (coloredAncientTarget && neowTarget) {
    const coloredNeowTarget = colorTag("gold:ancient", neowTarget);
    addPatchHeadingLabel(labels, "Ancients & Neow", `${coloredAncientTarget} & ${coloredNeowTarget}`);
    addPatchHeadingLabel(labels, "고대의 존재 & 니오우", `${coloredAncientTarget} & ${coloredNeowTarget}`);
    for (const source of [
      `${engEpochs["NEOW_EPOCH.title"] ?? engAncients["NEOW.title"]} Blessings`,
      "Neow Blessings",
    ]) {
      addPatchHeadingLabel(labels, source, `${coloredNeowTarget} Blessings`);
    }
    for (const source of [
      `${korEpochs["NEOW_EPOCH.title"] ?? korAncients["NEOW.title"]}의 축복`,
      "네오의 축복",
      "니오우의 축복",
    ]) {
      addPatchHeadingLabel(labels, source, `${coloredNeowTarget}의 축복`);
    }
  }

  const potionTarget = stripGameMarkup(gameGameplay["MULTIPLAYER_EXPANDED_STATE.potionHeader"]);
  const relicTarget = stripGameMarkup(gameGameplay["MULTIPLAYER_EXPANDED_STATE.relicHeader"]);
  if (potionTarget && relicTarget) {
    const potionsAndRelicsTarget = `${potionTarget} & ${relicTarget}`;
    for (const source of [
      `${stripGameMarkup(engGameplay["MULTIPLAYER_EXPANDED_STATE.potionHeader"])} & ${stripGameMarkup(engGameplay["MULTIPLAYER_EXPANDED_STATE.relicHeader"])}`,
      `${stripGameMarkup(korGameplay["MULTIPLAYER_EXPANDED_STATE.potionHeader"])} & ${stripGameMarkup(korGameplay["MULTIPLAYER_EXPANDED_STATE.relicHeader"])}`,
      "Potions & Relics",
      "포션 & 유물",
    ]) {
      addPatchHeadingLabel(labels, source, potionsAndRelicsTarget);
    }
  }

  const relicHeadingTarget = stripGameMarkup(gameGameplay["RELIC_RARITY.NONE"]);
  if (relicHeadingTarget) {
    addPatchHeadingLabel(labels, "Relic Changes", `${relicHeadingTarget} Changes`);
    addPatchHeadingLabel(labels, "유물 변경", `${relicHeadingTarget} 변경`);
  }

  const colorlessCardsTarget = gameLocale === "eng"
    ? "Colorless Cards"
    : stripSentencePunctuation(gameCardLibrary["POOL_COLORLESS_TIP"]);
  if (colorlessCardsTarget) {
    for (const source of [
      "Colorless Cards",
      stripSentencePunctuation(engCardLibrary["POOL_COLORLESS_TIP"]),
      stripSentencePunctuation(korCardLibrary["POOL_COLORLESS_TIP"]),
      "무색 카드",
    ]) {
      addPatchHeadingLabel(labels, source, colorlessCardsTarget);
    }
  }

  const multiplayerTarget = gameMainMenu["MULTIPLAYER"];
  for (const source of [
    engMainMenu["MULTIPLAYER"],
    korMainMenu["MULTIPLAYER"],
    "Multiplayer",
    "멀티플레이",
    "멀티플레이어",
  ]) {
    addPatchHeadingLabel(labels, source, multiplayerTarget);
    addPatchHeadingLabel(labels, `Card Changes - ${source}`, `Card Changes - ${multiplayerTarget}`);
    addPatchHeadingLabel(labels, `카드 변경 - ${source}`, `카드 변경 - ${multiplayerTarget}`);
  }

  return labels;
}

export async function generatePatchDetailStaticParams() {
  const patches = await getSTS2Patches();
  return patches.map((p) => ({ version: p.version }));
}

export async function getPatchDetailMetadata({
  version,
  serviceLocale,
}: {
  version: string;
  serviceLocale: ServiceLocale;
}): Promise<Metadata> {
  const patches = await getSTS2Patches();
  const patch = patches.find((p) => p.version === version);
  if (!patch) return {};

  const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
  const fallbackDescription = serviceLocale === "ko" ? patch.summaryKo : patch.summary;
  const [description, entities] = await Promise.all([
    readPatchOgDescription({
      version: patch.version,
      serviceLocale,
      fallback: fallbackDescription,
    }),
    loadAllEntities({ gameLocale: serviceLocale === "ko" ? "kor" : "eng" }),
  ]);
  const entitiesByKey = new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity]));
  const patchArt = resolvePatchArt(patch, entitiesByKey, serviceLocale);

  return getServiceOgMetadata({
    serviceLocale,
    title,
    description,
    image: {
      url: patchArt.imageUrl,
      alt: patchArt.alt,
    },
  });
}

export async function PatchDetailPage({
  version,
  serviceLocale,
  gameLocale,
}: {
  version: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = PATCH_COPY[serviceLocale];
  const [patches, versionDiffs, codexMeta, codexCards, codexRelics, codexPotions, codexPowers, codexEnchantments, codexEvents, codexMonsters, codexEncounters, codexAncients, codexEpochs, gameUi, gameKeywordLabels, gameHeadingLabels] = await Promise.all([
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getCodexEpochs({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
    getPatchGameKeywordLabels(gameLocale),
    getPatchGameHeadingLabels(gameLocale),
  ]);

  const patch = patches.find((p) => p.version === version);
  if (!patch) notFound();

  let markdown = "";
  const koPath = path.join(NOTES_DIR, `v${patch.version}.ko.md`);
  const enPath = path.join(NOTES_DIR, `v${patch.version}.md`);
  const preferredPath = serviceLocale === "ko" ? koPath : enPath;
  const fallbackPath = serviceLocale === "ko" ? enPath : koPath;
  try {
    markdown = await fs.readFile(preferredPath, "utf-8");
  } catch {
    try {
      markdown = await fs.readFile(fallbackPath, "utf-8");
    } catch {
      // No patch notes file yet
    }
  }

  const ancientOwnersByRelicId = new Map<string, typeof codexAncients>();
  for (const ancient of codexAncients) {
    for (const relicId of ancient.relicIds) {
      const owners = ancientOwnersByRelicId.get(relicId);
      if (owners) owners.push(ancient);
      else ancientOwnersByRelicId.set(relicId, [ancient]);
    }
  }
  const friendshipLabel = codexCards.find((card) => card.id === "FRIENDSHIP")?.name;
  const publicCodexMonsters = codexMonsters.filter((monster) =>
    monster.showInCompendium && isPublicBestiaryMonster(monster.id),
  );

  // Build entity info for the renderer (cards + relics + potions)
  const entities: EntityInfo[] = [
    ...codexCards.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameKo: patchDisplayName(c.name, c.nameEn, gameLocale),
      imageUrl: c.imageUrl,
      color: c.color,
      type: "card" as const,
      cardData: c,
    })),
    ...codexRelics.map((r) => ({
      id: r.id,
      nameEn: r.nameEn,
      nameKo: patchDisplayName(r.name, r.nameEn, gameLocale),
      aliasesEn: (ancientOwnersByRelicId.get(r.id) ?? []).flatMap((ancient) =>
        ancientRelicAliases(ancient.nameEn, r.nameEn),
      ),
      imageUrl: r.imageUrl,
      color: r.pool,
      type: "relic" as const,
      relicData: r,
    })),
    ...codexPotions.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: patchDisplayName(p.name, p.nameEn, gameLocale),
      imageUrl: p.imageUrl,
      color: p.pool,
      type: "potion" as const,
      potionData: p,
    })),
    ...codexPowers.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: patchDisplayName(p.name, p.nameEn, gameLocale),
      imageUrl: p.imageUrl,
      color: p.type,
      type: "power" as const,
      powerData: p,
    })),
    ...codexEnchantments.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: patchDisplayName(e.name, e.nameEn, gameLocale),
      imageUrl: e.imageUrl,
      color: e.cardType ?? "Any",
      type: "enchantment" as const,
      enchantmentData: e,
    })),
    ...codexEvents.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: patchDisplayName(e.name, e.nameEn, gameLocale),
      aliasesEn: [
        ...(PATCH_ENTITY_ALIASES_EN[e.id] ?? []),
        ...punctuationRelaxedAliases(e.nameEn),
      ],
      aliasesKo: punctuationRelaxedAliases(e.name),
      imageUrl: e.imageUrl,
      color: e.act ?? "none",
      type: "event" as const,
      eventData: e,
    })),
    // Event options (choices) — hover shows option rich text
    ...codexEvents.flatMap((e) =>
      (e.options ?? [])
        .filter((o) => !o.id.endsWith("_LOCKED") && o.title !== "잠김" && o.description)
        .map((o) => ({
          id: `${e.id}__${o.id}`,
          nameEn: "",
          nameKo: o.title,
          imageUrl: null,
          color: e.act ?? "none",
          type: "event" as const,
          eventData: e,
          eventOptionDesc: o.description,
        })),
    ),
    ...publicCodexMonsters.map((m) => ({
      id: m.id,
      nameEn: m.nameEn,
      nameKo: patchDisplayName(m.name, m.nameEn, gameLocale),
      aliasesEn: PATCH_ENTITY_ALIASES_EN[m.id],
      imageUrl: m.bossImageUrl ?? m.imageUrl,
      color: m.type,
      type: "monster" as const,
      monsterData: m,
    })),
    ...buildPatchMonsterMoveEntities(publicCodexMonsters, patch.version, gameLocale),
    ...codexEncounters.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: patchDisplayName(e.name, e.nameEn, gameLocale),
      aliasesEn: PATCH_ENTITY_ALIASES_EN[e.id],
      imageUrl: e.imageUrl,
      color: e.roomType,
      type: "encounter" as const,
      encounterData: e,
    })),
    ...codexAncients.map((a) => ({
      id: a.id,
      nameEn: a.nameEn,
      nameKo: patchDisplayName(a.name, a.nameEn, gameLocale),
      imageUrl: a.imageUrl,
      color: a.act ?? "none",
      type: "ancient" as const,
      ancientData: a,
    })),
    ...codexEpochs.map((e) => {
      const idLower = e.id.toLowerCase();
      const override = PATCH_EPOCH_LABEL_OVERRIDES[e.id];
      const selectedEpochName = e.name;
      const selectedName = override ? friendshipLabel ?? selectedEpochName : selectedEpochName;
      const nameEn = override?.nameEn ?? e.nameEn;
      return {
        id: e.id,
        nameEn,
        nameKo: patchDisplayName(selectedName, nameEn, gameLocale),
        aliasesEn: override?.aliasesEn,
        aliasesKo: [
          override?.nameKo,
          e.name,
          selectedEpochName,
          ...(override?.aliasesKo ?? []),
        ].filter((alias): alias is string => Boolean(alias)),
        imageUrl: e.imageUrl,
        href: `/compendium/epochs?epoch=${idLower}`,
        color: e.affiliation,
        type: "epoch" as const,
        epochData: e,
      };
    }),
  ];

  const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
  const versionLabel = getPatchVersionLabel(patch, serviceLocale);
  const rendererEntities = filterPatchNoteEntities(markdown, entities);
  const isBuilding = patch.status === "building";
  const entitiesByKey = new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity]));
  const patchArt = resolvePatchArt(patch, entitiesByKey, serviceLocale);

  // Adjacent patches for navigation
  const sortedPatches = [...patches].sort((a, b) => a.date.localeCompare(b.date));
  const idx = sortedPatches.findIndex((p) => p.id === patch.id);
  const prevPatch = idx > 0 ? sortedPatches[idx - 1] : null;
  const nextPatch = idx < sortedPatches.length - 1 ? sortedPatches[idx + 1] : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale)}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; {copy.backToList}
      </Link>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{versionLabel}</h1>
          <Badge variant="outline" className={PATCH_TYPE_CLASSES[patch.type]}>
            {copy.types[patch.type]}
          </Badge>
          {isBuilding && (
            <Badge variant="outline" className="bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/40">
              {copy.buildingBadge}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-lg font-medium">{title}</p>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{patch.date}</span>
          {patch.steamUrl && !isBuilding && (
            <a
              href={patch.steamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {copy.steamOriginal} &rarr;
            </a>
          )}
        </div>
      </div>

      <PatchArtHero art={patchArt} />

      {/* Patch notes body */}
      {markdown ? (
        <section className="mt-6">
          <PatchNoteRenderer
            markdown={markdown}
            entities={rendererEntities}
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            preferEntityLocaleLabel={serviceLocale !== "ko" || gameLocale !== "kor"}
            gameKeywordLabels={gameKeywordLabels}
            gameHeadingLabels={gameHeadingLabels}
            patchVersion={patch.version}
            currentVersion={codexMeta.version}
            patches={patches}
            versionDiffs={versionDiffs}
          />
        </section>
      ) : (
        <div className="mt-8 rounded-lg border border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          {isBuilding ? (
            <>
              <p className="font-medium text-foreground">{copy.buildingTitle}</p>
              <p className="mt-2">{copy.buildingBody}</p>
            </>
          ) : (
            copy.missing
          )}
        </div>
      )}

      <section className="mt-8 rounded-lg border border-border bg-card/20 p-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">{copy.comments}</h2>
        <DeferredCommentSection
          threadKey={buildPatchCommentThreadKey(patch.version)}
        />
      </section>

      {/* Patch navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        {prevPatch ? (
          <Link
            href={localizeHrefWithGameLocale(`/patches/${prevPatch.version}`, serviceLocale, gameLocale)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; {getPatchVersionLabel(prevPatch, serviceLocale)}
          </Link>
        ) : (
          <span />
        )}
        {nextPatch ? (
          <Link
            href={localizeHrefWithGameLocale(`/patches/${nextPatch.version}`, serviceLocale, gameLocale)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {getPatchVersionLabel(nextPatch, serviceLocale)} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

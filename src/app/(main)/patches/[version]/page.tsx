import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import fs from "fs/promises";
import path from "path";
import { getSTS2Patches } from "@/lib/data";
import { getCodexCards, getCodexRelics, getCodexPotions, getCodexPowers, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexEncounters, getCodexAncients } from "@/lib/codex-data";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { readGameLocalizationTable, type GameLocalizationTable } from "@/lib/game-localization";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import {
  PatchNoteRenderer,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import { CommentSection } from "@/components/comment-section";
import { buildPatchCommentThreadKey } from "@/lib/comment-threads";
import { withPageOgImage } from "@/lib/page-og-images";
import type { PatchType } from "@/lib/types";

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

const NOTES_DIR = path.join(process.cwd(), "data/sts2-patch-notes");

const PATCH_ENTITY_ALIASES_EN: Record<string, string[]> = {
  AXEBOTS_NORMAL: ["Axebots"],
  ASSASSIN_RUBY_RAIDER: ["Ruby Raider Assassin"],
  GREMLIN_MERC: ["Gremlin Mercenary"],
};

interface PatchEpoch {
  id: string;
  title: string;
}

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
  labels[sourceLabel.trim().toLowerCase()] = targetLabel;
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

export async function generateStaticParams() {
  const patches = await getSTS2Patches();
  return patches.map((p) => ({ version: p.version }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ version: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ version }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const patches = await getSTS2Patches();
  const patch = patches.find((p) => p.version === version);
  if (!patch) return {};

  const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
  const description = serviceLocale === "ko" ? patch.summaryKo : patch.summary;

  return withPageOgImage({
    ...getCodexMetadata(serviceLocale, `v${patch.version} ${title}`),
    description,
  }, `/patches/${patch.version}`);
}

export default async function PatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ version: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { version } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const copy = PATCH_COPY[serviceLocale];
  const epochsDir = path.join(process.cwd(), "public/images/sts2/epochs");
  const [patches, codexCards, codexRelics, codexPotions, codexPowers, codexEnchantments, codexEvents, codexMonsters, codexEncounters, codexAncients, korEpochData, engEpochData, gameEpochs, epochImageFiles, gameUi, gameKeywordLabels, gameHeadingLabels] = await Promise.all([
    getSTS2Patches(),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexAncients({ gameLocale }),
    fs.readFile(path.join(process.cwd(), "data/sts2/kor/epochs.json"), "utf-8").then((raw) => JSON.parse(raw) as PatchEpoch[]),
    fs.readFile(path.join(process.cwd(), "data/sts2/eng/epochs.json"), "utf-8").then((raw) => JSON.parse(raw) as PatchEpoch[]),
    readGameLocalizationTable(gameLocale, "epochs"),
    fs.readdir(epochsDir).then(
      (files) => new Set(files.filter((file) => file.endsWith(".webp")).map((file) => file.replace(".webp", ""))),
      () => new Set<string>(),
    ),
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
  const engEpochById = new Map(engEpochData.map((epoch) => [epoch.id, epoch]));
  const friendshipLabel = codexCards.find((card) => card.id === "FRIENDSHIP")?.name;

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
    ...codexMonsters.map((m) => ({
      id: m.id,
      nameEn: m.nameEn,
      nameKo: patchDisplayName(m.name, m.nameEn, gameLocale),
      aliasesEn: PATCH_ENTITY_ALIASES_EN[m.id],
      imageUrl: m.bossImageUrl ?? m.imageUrl,
      color: m.type,
      type: "monster" as const,
      monsterData: m,
    })),
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
    ...korEpochData.map((e) => {
      const idLower = e.id.toLowerCase();
      const override = PATCH_EPOCH_LABEL_OVERRIDES[e.id];
      const selectedEpochName = gameEpochs[`${e.id}.title`]
        ?? (gameLocale === "kor" ? e.title : engEpochById.get(e.id)?.title ?? e.title);
      const selectedName = override ? friendshipLabel ?? selectedEpochName : selectedEpochName;
      return {
        id: e.id,
        nameEn: override?.nameEn ?? engEpochById.get(e.id)?.title ?? e.title,
        nameKo: patchDisplayName(selectedName, override?.nameEn ?? engEpochById.get(e.id)?.title ?? e.title, gameLocale),
        aliasesEn: override?.aliasesEn,
        aliasesKo: [
          override?.nameKo,
          e.title,
          selectedEpochName,
          ...(override?.aliasesKo ?? []),
        ].filter((alias): alias is string => Boolean(alias)),
        imageUrl: epochImageFiles.has(idLower) ? `/images/sts2/epochs/${idLower}.webp` : null,
        href: null,
        color: "epoch",
        type: "epoch" as const,
      };
    }),
  ];

  const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
  const commentEntities = entities.filter((entity) => !entity.eventOptionDesc);
  const isBuilding = patch.status === "building";

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
          <h1 className="text-2xl font-bold">v{patch.version}</h1>
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

      {/* Patch notes body */}
      {markdown ? (
        <section className="mt-6">
          <PatchNoteRenderer
            markdown={markdown}
            entities={entities}
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            preferEntityLocaleLabel={serviceLocale !== "ko" || gameLocale !== "kor"}
            gameKeywordLabels={gameKeywordLabels}
            gameHeadingLabels={gameHeadingLabels}
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
        <CommentSection
          threadKey={buildPatchCommentThreadKey(patch.version)}
          initialEntities={commentEntities}
        />
      </section>

      {/* Patch navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        {prevPatch ? (
          <Link
            href={localizeHrefWithGameLocale(`/patches/${prevPatch.version}`, serviceLocale, gameLocale)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; v{prevPatch.version}
          </Link>
        ) : (
          <span />
        )}
        {nextPatch ? (
          <Link
            href={localizeHrefWithGameLocale(`/patches/${nextPatch.version}`, serviceLocale, gameLocale)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            v{nextPatch.version} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

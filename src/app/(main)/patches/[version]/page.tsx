import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs/promises";
import path from "path";
import { getSTS2Patches } from "@/lib/data";
import { getCodexCards, getCodexRelics, getCodexPotions, getCodexPowers, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexEncounters, getCodexAncients } from "@/lib/codex-data";
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
import type { PatchType } from "@/lib/types";

const PATCH_COPY: Record<ServiceLocale, {
  backToList: string;
  steamOriginal: string;
  missing: string;
  comments: string;
  types: Record<PatchType, string>;
}> = {
  ko: {
    backToList: "패치 목록",
    steamOriginal: "Steam 원문",
    missing: "패치 노트 원문이 아직 준비되지 않았습니다.",
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
  return key.endsWith(".title") || key.endsWith("Title");
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
    labels[sourceLabel.trim().toLowerCase()] = targetLabel;
  }
}

async function getPatchGameKeywordLabels(gameLocale: GameLocale): Promise<Record<string, string>> {
  const [
    engBadges,
    korBadges,
    gameBadges,
    engModifiers,
    korModifiers,
    gameModifiers,
  ] = await Promise.all([
    readGameLocalizationTable("eng", "badges"),
    readGameLocalizationTable("kor", "badges"),
    readGameLocalizationTable(gameLocale, "badges"),
    readGameLocalizationTable("eng", "modifiers"),
    readGameLocalizationTable("kor", "modifiers"),
    readGameLocalizationTable(gameLocale, "modifiers"),
  ]);

  const labels: Record<string, string> = {};
  addPatchKeywordLabels(labels, engBadges, gameBadges);
  addPatchKeywordLabels(labels, korBadges, gameBadges);
  addPatchKeywordLabels(labels, engModifiers, gameModifiers);
  addPatchKeywordLabels(labels, korModifiers, gameModifiers);
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
  const [patches, codexCards, codexRelics, codexPotions, codexPowers, codexEnchantments, codexEvents, codexMonsters, codexEncounters, codexAncients, gameUi, gameKeywordLabels, gameHeadingLabels] = await Promise.all([
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

  // Build entity info for the renderer (cards + relics + potions)
  const entities: EntityInfo[] = [
    ...codexCards.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameKo: c.name,
      imageUrl: c.imageUrl,
      color: c.color,
      type: "card" as const,
      cardData: c,
    })),
    ...codexRelics.map((r) => ({
      id: r.id,
      nameEn: r.nameEn,
      nameKo: r.name,
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
      nameKo: p.name,
      imageUrl: p.imageUrl,
      color: p.pool,
      type: "potion" as const,
      potionData: p,
    })),
    ...codexPowers.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      imageUrl: p.imageUrl,
      color: p.type,
      type: "power" as const,
      powerData: p,
    })),
    ...codexEnchantments.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.cardType ?? "Any",
      type: "enchantment" as const,
      enchantmentData: e,
    })),
    ...codexEvents.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
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
      nameKo: m.name,
      aliasesEn: PATCH_ENTITY_ALIASES_EN[m.id],
      imageUrl: m.bossImageUrl ?? m.imageUrl,
      color: m.type,
      type: "monster" as const,
      monsterData: m,
    })),
    ...codexEncounters.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      aliasesEn: PATCH_ENTITY_ALIASES_EN[e.id],
      imageUrl: e.imageUrl,
      color: e.roomType,
      type: "encounter" as const,
      encounterData: e,
    })),
    ...codexAncients.map((a) => ({
      id: a.id,
      nameEn: a.nameEn,
      nameKo: a.name,
      imageUrl: a.imageUrl,
      color: a.act ?? "none",
      type: "ancient" as const,
      ancientData: a,
    })),
  ];

  const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
  const commentEntities = entities.filter((entity) => !entity.eventOptionDesc);

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
        </div>
        <p className="mt-1 text-lg font-medium">{title}</p>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{patch.date}</span>
          {patch.steamUrl && (
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
          {copy.missing}
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

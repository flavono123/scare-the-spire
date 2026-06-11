"use client";

import { type ReactNode, useMemo, useState } from "react";
import { CircleDot, HeartCrack, Skull, Sword } from "lucide-react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import {
  CHARACTER_COLORS,
  characterOutlineFilter,
  type CharacterAncientInteraction,
  type CodexAncient,
  type CodexCard,
  type CodexCharacter,
  type CodexRelic,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { GameHoverTip } from "./hover-tip";
import { MonsterSpineStage } from "./monster-spine-stage";
import { RichDescription } from "./rich-description";
import { STS2ChangeHistory } from "./sts2-change-history";

type CharacterActionId = "IDLE" | "ATTACK" | "HURT" | "DIE";

const CHARACTER_DESCRIPTION_EXCLUDED_ENTITY_TYPES = new Set<EntityInfo["type"]>(["epoch"]);
const CHARACTER_STAGE_VIEWPORT_PADDING = {
  padLeft: "14%",
  padRight: "14%",
  padTop: "10%",
  padBottom: "0%",
} as const;

const ACTIONS: {
  id: CharacterActionId;
  labelKo: string;
  labelEn: string;
  Icon: typeof CircleDot;
}[] = [
  { id: "IDLE", labelKo: "대기", labelEn: "Idle", Icon: CircleDot },
  { id: "ATTACK", labelKo: "공격", labelEn: "Attack", Icon: Sword },
  { id: "HURT", labelKo: "피격", labelEn: "Hurt", Icon: HeartCrack },
  { id: "DIE", labelKo: "사망", labelEn: "Defeat", Icon: Skull },
];

function MetaPill({ value, color }: { value: string; color?: string }) {
  return (
    <span
      className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  );
}

function InfoRailSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group min-w-0 rounded-lg border border-white/10 bg-black/20 px-4 py-3"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-gray-200">
        <span>{title}</span>
        <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function getCharacterDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        stats: {
          hp: "체력 {value}",
          gold: "골드 {value}",
          energy: "에너지 {value}",
          orbs: "구체 {value}",
        },
        startingDeck: "시작 덱",
        startingRelics: "시작 유물",
        unlocksAfter: "{name} 플레이 후 해금",
        gameText: "게임 문구",
        ancientInteractions: "고대의 존재 상호작용",
        interactionCount: "{count}개",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        stats: {
          hp: "{value} HP",
          gold: "{value} Gold",
          energy: "{value} Energy",
          orbs: "{value} Orbs",
        },
        startingDeck: "Starting deck",
        startingRelics: "Starting relics",
        unlocksAfter: "Unlocked after playing {name}",
        gameText: "Game text",
        ancientInteractions: "Ancient Interactions",
        interactionCount: "{count}",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

function formatLabel(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
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

function resolveCodexResource<T extends { id: string }>(resources: ReadonlyMap<string, T>, gameId: string) {
  return resources.get(gameId) ?? resources.get(gameId.toUpperCase()) ?? resources.get(normalizeGameResourceId(gameId)) ?? null;
}

interface CharacterDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  character: CodexCharacter;
  characters?: CodexCharacter[];
  cards?: CodexCard[];
  relics?: CodexRelic[];
  ancients?: CodexAncient[];
  onClose?: () => void;
  entities?: EntityInfo[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

export function CharacterDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  character,
  characters = [],
  cards = [],
  relics = [],
  ancients = [],
  onClose,
  entities,
  patches,
  changes,
  versionDiffs,
}: CharacterDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getCharacterDetailLabels(serviceLocale);
  const characterPool = character.id.toLowerCase();
  const characterColor = CHARACTER_COLORS[characterPool] ?? "#eab308";
  const [selectedAction, setSelectedAction] = useState<CharacterActionId>("IDLE");
  const [selectedActionNonce, setSelectedActionNonce] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const excludeSelf = useMemo(
    () => new Set([character.name, character.nameEn]),
    [character.name, character.nameEn],
  );
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const relicById = useMemo(() => new Map(relics.map((relic) => [relic.id, relic])), [relics]);
  const ancientById = useMemo(() => new Map(ancients.map((ancient) => [ancient.id, ancient])), [ancients]);
  const unlockCharacter = character.unlocksAfter
    ? characters.find((item) => item.id === character.unlocksAfter)?.name ?? character.unlocksAfter
    : null;
  const startingCardTargets = character.startingDeckIds.map((cardId, index) => {
    const card = resolveCodexResource(cardById, cardId);
    const hrefId = card?.id ?? normalizeGameResourceId(cardId);
    const href = `/compendium/cards/${hrefId.toLowerCase()}`;
    return {
      id: `${cardId}:${index}`,
      href,
      title: card?.name ?? cardId,
      entity: card
        ? {
            id: card.id,
            nameEn: card.nameEn,
            nameKo: card.name,
            imageUrl: card.imageUrl,
            href,
            color: card.color,
            type: "card" as const,
            cardData: card,
          }
        : undefined,
    };
  });
  const startingRelicTargets = character.startingRelicIds.map((relicId, index) => {
    const relic = resolveCodexResource(relicById, relicId);
    const hrefId = relic?.id ?? normalizeGameResourceId(relicId);
    const href = `/compendium/relics/${hrefId.toLowerCase()}`;
    return {
      id: `${relicId}:${index}`,
      href,
      title: relic?.name ?? relicId,
      entity: relic
        ? {
            id: relic.id,
            nameEn: relic.nameEn,
            nameKo: relic.name,
            imageUrl: relic.imageUrl,
            href,
            color: relic.pool,
            type: "relic" as const,
            relicData: relic,
          }
        : undefined,
    };
  });
  const ancientTargets = [...new Set(character.ancientInteractions.map((interaction) => interaction.ancientId))]
    .map((ancientId) => ancientById.get(ancientId))
    .filter((ancient): ancient is CodexAncient => Boolean(ancient))
    .map(ancientToReferenceTarget);
  const availableActions = ACTIONS.filter((action) => {
    if (!character.spineAsset) return action.id === "IDLE";
    return action.id === "IDLE" || Boolean(character.spineAsset.moveAnimations[action.id]?.length);
  });
  const quoteLines = [
    character.quotes.eventDeathPrevention,
    character.quotes.goldMonologue,
    character.quotes.aromaPrinciple,
    character.quotes.banterAlive,
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/characters", serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => {
            if (onClose) {
              event.preventDefault();
              onClose();
            }
          }}
        >
          ← {backToListTitle}
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[30rem] min-w-0 flex-col items-center justify-center gap-5 py-4">
          <div className="relative h-[24rem] w-full max-w-full sm:h-[28rem] lg:max-w-[44rem]">
            <div className="pointer-events-none absolute inset-x-8 bottom-0 h-24 rounded-[50%] bg-black/40 blur-2xl" />
            <MonsterSpineStage
              key={character.id}
              asset={character.spineAsset}
              fallbackImageUrl={character.combatImageUrl}
              monsterName={character.name}
              selectedMoveId={selectedAction}
              selectedMoveNonce={selectedActionNonce}
              imagePriority
              showLoadingLabel={false}
              viewportTransitionTime={0}
              viewportPadding={CHARACTER_STAGE_VIEWPORT_PADDING}
              fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
              className="relative h-full w-full"
            />
          </div>

          <div className="flex max-w-full flex-wrap justify-center gap-2" role="group" aria-label={serviceLocale === "ko" ? "모션" : "Actions"}>
            {availableActions.map((action) => {
              const active = action.id === selectedAction;
              const Icon = action.Icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  title={serviceLocale === "ko" ? action.labelKo : action.labelEn}
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedAction(action.id);
                    setSelectedActionNonce((value) => value + 1);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 font-game-text text-xs font-bold transition-colors hover:bg-white/10"
                  style={{
                    borderColor: active ? characterColor : "rgba(255,255,255,0.12)",
                    backgroundColor: active ? `${characterColor}24` : "rgba(255,255,255,0.04)",
                    color: active ? characterColor : "#d4d4d8",
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{serviceLocale === "ko" ? action.labelKo : action.labelEn}</span>
                </button>
              );
            })}
          </div>

          <GameHoverTip
            title={character.name}
            className="w-full max-w-full sm:max-w-[26rem]"
            style={{ minWidth: 0 }}
          >
            {entities ? (
              <RichDescription
                description={character.description}
                entities={entities}
                excludeEntityTerms={excludeSelf}
                excludeEntityTypes={CHARACTER_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                className="block text-left"
              />
            ) : (
              <DescriptionText description={character.description} className="block text-left" />
            )}
          </GameHoverTip>
        </section>

        <aside className="flex min-w-0 flex-col gap-3">
          <section className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill value={serviceLocale === "ko" ? "캐릭터" : "Character"} color={characterColor} />
                <MetaPill value={formatLabel(detailLabels.stats.hp, { value: character.startingHp })} />
                <MetaPill value={formatLabel(detailLabels.stats.gold, { value: character.startingGold })} />
                <MetaPill value={formatLabel(detailLabels.stats.energy, { value: character.maxEnergy })} />
                {character.orbSlots !== null && (
                  <MetaPill value={formatLabel(detailLabels.stats.orbs, { value: character.orbSlots })} color={characterColor} />
                )}
              </div>
              {character.nameEn !== character.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{character.nameEn}</div>
                </div>
              )}
              {unlockCharacter && (
                <div className="font-game-text text-xs text-gray-500">
                  {formatLabel(detailLabels.unlocksAfter, { name: unlockCharacter })}
                </div>
              )}
              <div className="flex items-center gap-3">
                <Image
                  src={character.iconUrl}
                  alt=""
                  width={42}
                  height={42}
                  className="h-10 w-10 object-contain"
                  style={{ filter: characterOutlineFilter(characterPool) }}
                />
                <Image
                  src={character.restImageUrl}
                  alt=""
                  width={70}
                  height={70}
                  className="h-12 w-16 object-contain opacity-75"
                />
              </div>
            </div>
          </section>

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            groups={[
              { kind: "card", targets: startingCardTargets },
              { kind: "relic", targets: startingRelicTargets },
              { kind: "ancient", targets: ancientTargets },
            ]}
          />

          {quoteLines.length > 0 && (
            <InfoRailSection title={detailLabels.gameText}>
              <div className="space-y-2 font-game-text text-xs leading-relaxed text-gray-400">
                {quoteLines.map((quote, index) => (
                  <p key={`${character.id}-quote-${index}`}>
                    {entities ? (
                      <RichDescription
                        description={quote}
                        entities={entities}
                        excludeEntityTerms={excludeSelf}
                        excludeEntityTypes={CHARACTER_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                      />
                    ) : (
                      <DescriptionText description={quote} />
                    )}
                  </p>
                ))}
              </div>
            </InfoRailSection>
          )}

          <InfoRailSection title={detailLabels.ancientInteractions}>
            <CharacterAncientInteractions
              character={character}
              ancients={ancients}
              entities={entities}
              excludeSelf={excludeSelf}
              serviceLocale={serviceLocale}
            />
          </InfoRailSection>

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="character"
              entityId={character.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("character", character.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

function CharacterAncientInteractions({
  character,
  ancients,
  entities,
  excludeSelf,
  serviceLocale,
}: {
  character: CodexCharacter;
  ancients: CodexAncient[];
  entities?: EntityInfo[];
  excludeSelf: ReadonlySet<string>;
  serviceLocale: ServiceLocale;
}) {
  const groups = useMemo(() => {
    const grouped = new Map<string, CharacterAncientInteraction[]>();
    for (const interaction of character.ancientInteractions) {
      const list = grouped.get(interaction.ancientId) ?? [];
      list.push(interaction);
      grouped.set(interaction.ancientId, list);
    }
    return [...grouped.entries()].map(([ancientId, interactions]) => ({
      ancientId,
      interactions,
      ancient: ancients.find((item) => item.id === ancientId) ?? null,
    }));
  }, [ancients, character.ancientInteractions]);
  const firstAncientId = groups[0]?.ancientId ?? "";
  const [activeAncientSelection, setActiveAncientSelection] = useState(() => ({
    characterId: character.id,
    ancientId: firstAncientId,
  }));
  const activeAncientId =
    activeAncientSelection.characterId === character.id
      ? activeAncientSelection.ancientId
      : firstAncientId;
  const activeGroup = groups.find((group) => group.ancientId === activeAncientId) ?? groups[0] ?? null;

  if (!activeGroup) {
    return <p className="font-game-text text-sm text-gray-500">{serviceLocale === "ko" ? "대사 데이터가 없습니다." : "No dialogue data."}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => {
          const active = group.ancientId === activeGroup.ancientId;
          const label = group.ancient?.name ?? group.interactions[0]?.ancientName ?? group.ancientId;
          return (
            <button
              key={group.ancientId}
              type="button"
              title={label}
              aria-pressed={active}
              onClick={() =>
                setActiveAncientSelection({
                  characterId: character.id,
                  ancientId: group.ancientId,
                })
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-white/[0.03] transition-colors hover:bg-white/10"
              style={{
                borderColor: active ? "rgba(96,165,250,0.72)" : "rgba(255,255,255,0.1)",
                boxShadow: active ? "0 0 14px rgba(96,165,250,0.24)" : undefined,
              }}
            >
              {group.ancient?.imageUrl ? (
                <Image
                  src={group.ancient.imageUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain"
                />
              ) : (
                <span className="font-game-title text-xs text-blue-200">{label.slice(0, 2)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
        {activeGroup.interactions.map((interaction, interactionIndex) => (
          <div key={interaction.id} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-game-title text-sm text-blue-200">
                {activeGroup.ancient?.name ?? interaction.ancientName}
              </div>
              <div className="text-[10px] text-gray-600">#{interactionIndex + 1}</div>
            </div>
            <div className="space-y-2">
              {interaction.lines.map((line, lineIndex) => {
                const isCharacter = line.speaker === "character";
                return (
                  <div
                    key={`${interaction.id}-${line.order}-${lineIndex}`}
                    className={`flex ${isCharacter ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-relaxed ${
                        isCharacter
                          ? "border-zinc-600/40 bg-zinc-800/80 text-zinc-200"
                          : "border-blue-500/20 bg-blue-500/10 text-blue-100"
                      }`}
                    >
                      <div className="mb-1 text-[10px] font-medium opacity-60">
                        {isCharacter ? character.name : activeGroup.ancient?.name ?? interaction.ancientName}
                      </div>
                      {entities ? (
                        <RichDescription
                          description={line.text}
                          entities={entities}
                          excludeEntityTerms={excludeSelf}
                          excludeEntityTypes={CHARACTER_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                        />
                      ) : (
                        <DescriptionText description={line.text} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ancientToReferenceTarget(ancient: CodexAncient): CodexReferenceTarget {
  const href = `/compendium/ancients/${ancient.id.toLowerCase()}`;
  return {
    href,
    id: ancient.id,
    title: ancient.name,
    entity: {
      id: ancient.id,
      nameEn: ancient.nameEn,
      nameKo: ancient.name,
      imageUrl: ancient.imageUrl,
      href,
      color: ancient.act ?? "ancient",
      type: "ancient",
      ancientData: ancient,
    },
  };
}

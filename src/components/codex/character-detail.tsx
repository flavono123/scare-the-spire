"use client";

import { type ReactNode, type WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleDot,
  Crown,
  Hammer,
  HeartCrack,
  Skull,
  Sparkles,
  Sword,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
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
import { MonsterAscensionStepper, useMonsterAscensionLevel } from "./monster-ascension";
import { MonsterSpineStage } from "./monster-spine-stage";
import { RichDescription } from "./rich-description";
import { STS2ChangeHistory } from "./sts2-change-history";

type CharacterActionId = "IDLE" | "ATTACK" | "HEAVY_ATTACK" | "CAST" | "SOVEREIGN_BLADE" | "HURT" | "DIE";

const CHARACTER_DESCRIPTION_EXCLUDED_ENTITY_TYPES = new Set<EntityInfo["type"]>(["epoch"]);
const CHARACTER_STAGE_VIEWPORT_PADDING = {
  padLeft: "14%",
  padRight: "14%",
  padTop: "10%",
  padBottom: "0%",
} as const;
const CHARACTER_WEARY_TRAVELER_ASCENSION_LEVEL = 2;
const CHARACTER_ASCENDED_HP_PREVIEW_RATIO = 0.8;
const HEALTH_BAR_CLIP_PATH = "polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%)";

const ACTIONS: {
  id: CharacterActionId;
  labelKo: string;
  labelEn: string;
  Icon: LucideIcon;
}[] = [
  { id: "IDLE", labelKo: "대기", labelEn: "Idle", Icon: CircleDot },
  { id: "ATTACK", labelKo: "공격", labelEn: "Attack", Icon: Sword },
  { id: "HEAVY_ATTACK", labelKo: "강공격", labelEn: "Heavy Attack", Icon: Hammer },
  { id: "CAST", labelKo: "시전", labelEn: "Cast", Icon: WandSparkles },
  { id: "SOVEREIGN_BLADE", labelKo: "군주의 칼날", labelEn: "Sovereign Blade", Icon: Crown },
  { id: "HURT", labelKo: "피격", labelEn: "Hurt", Icon: HeartCrack },
  { id: "DIE", labelKo: "사망", labelEn: "Defeat", Icon: Skull },
];

function InfoMetric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="font-game-text text-sm font-bold text-gray-200" style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
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
        resourceKind: "분류",
        stats: {
          hp: "체력",
          gold: "골드",
          energy: "에너지",
          orbs: "구체",
        },
        ascensionHeal: "A2+ 고대의 존재 회복 80%",
        startingDeck: "시작 덱",
        startingRelics: "시작 유물",
        unlocksAfter: "{name} 플레이 후 해금",
        gameText: "게임 문구",
        gameTextIntro: "게임 원본은 캐릭터별 대사를 아래 네 상황 키로 제공합니다.",
        quoteContexts: {
          eventDeathPrevention: {
            title: "죽음 방지",
            description: "이벤트 선택지가 체력 0을 막아줄 때 말풍선으로 출력됩니다.",
          },
          goldMonologue: {
            title: "가라앉은 금고",
            description: "Sunken Treasury에서 골드를 바라보는 캐릭터 독백입니다.",
          },
          aromaPrinciple: {
            title: "혼돈의 향기",
            description: "Aroma of Chaos에서 정신을 붙잡기 위해 반복하는 핵심 원칙입니다.",
          },
          banterAlive: {
            title: "생존 재촉",
            description: "생존 중 턴 종료를 기다릴 때 나오는 캐릭터별 재촉 대사입니다.",
          },
        },
        ancientInteractions: "고대의 존재 상호작용",
        interactionCount: "{count}개",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        resourceKind: "Kind",
        stats: {
          hp: "HP",
          gold: "Gold",
          energy: "Energy",
          orbs: "Orbs",
        },
        ascensionHeal: "A2+ Ancient heal 80%",
        startingDeck: "Starting deck",
        startingRelics: "Starting relics",
        unlocksAfter: "Unlocked after playing {name}",
        gameText: "Game text",
        gameTextIntro: "The game provides character lines through these four situation keys.",
        quoteContexts: {
          eventDeathPrevention: {
            title: "Death prevention",
            description: "Shown as a thought bubble when an event option prevents lethal damage.",
          },
          goldMonologue: {
            title: "Sunken Treasury",
            description: "Character monologue when looking at gold in Sunken Treasury.",
          },
          aromaPrinciple: {
            title: "Aroma of Chaos",
            description: "Core principle repeated to stay in control during Aroma of Chaos.",
          },
          banterAlive: {
            title: "Alive ping",
            description: "Character-specific prompt while alive and waiting to end the turn.",
          },
        },
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

function buildStartingCardTargets(
  cardIds: readonly string[],
  cardById: ReadonlyMap<string, CodexCard>,
): CodexReferenceTarget[] {
  const grouped = new Map<string, { cardId: string; card: CodexCard | null; hrefId: string; count: number }>();

  for (const cardId of cardIds) {
    const card = resolveCodexResource(cardById, cardId);
    const hrefId = card?.id ?? normalizeGameResourceId(cardId);
    const existing = grouped.get(hrefId);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(hrefId, { cardId, card, hrefId, count: 1 });
    }
  }

  return Array.from(grouped.values()).map(({ cardId, card, hrefId, count }) => {
    const href = `/compendium/cards/${hrefId.toLowerCase()}`;
    const title = card?.name ?? cardId;
    return {
      id: `card:${hrefId}`,
      href,
      title: count > 1 ? `${title} x${count}` : title,
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
}

function buildStartingRelicTargets(
  relicIds: readonly string[],
  relicById: ReadonlyMap<string, CodexRelic>,
): CodexReferenceTarget[] {
  return relicIds.map((relicId, index) => {
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
  const [ascensionLevel, setAscensionLevel] = useMonsterAscensionLevel();
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
  const startingCardTargets = useMemo(
    () => buildStartingCardTargets(character.startingDeckIds, cardById),
    [cardById, character.startingDeckIds],
  );
  const startingRelicTargets = useMemo(
    () => buildStartingRelicTargets(character.startingRelicIds, relicById),
    [character.startingRelicIds, relicById],
  );
  const ancientTargets = [...new Set(character.ancientInteractions.map((interaction) => interaction.ancientId))]
    .map((ancientId) => ancientById.get(ancientId))
    .filter((ancient): ancient is CodexAncient => Boolean(ancient))
    .map(ancientToReferenceTarget);
  const availableActions = ACTIONS.filter((action) => {
    if (!character.spineAsset) return action.id === "IDLE";
    return (
      action.id === "IDLE" ||
      Boolean(character.spineAsset.moveAnimations[action.id]?.length) ||
      Boolean(character.spineAsset.moveEffects[action.id]?.some((effect) => effect.usable !== false))
    );
  });
  const quoteRows = [
    {
      id: "eventDeathPrevention",
      text: character.quotes.eventDeathPrevention,
      ...detailLabels.quoteContexts.eventDeathPrevention,
    },
    {
      id: "goldMonologue",
      text: character.quotes.goldMonologue,
      ...detailLabels.quoteContexts.goldMonologue,
    },
    {
      id: "aromaPrinciple",
      text: character.quotes.aromaPrinciple,
      ...detailLabels.quoteContexts.aromaPrinciple,
    },
    {
      id: "banterAlive",
      text: character.quotes.banterAlive,
      ...detailLabels.quoteContexts.banterAlive,
    },
  ].filter((row): row is { id: string; title: string; description: string; text: string } => Boolean(row.text));

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
            <div className="absolute left-2 top-2 z-50 sm:left-3 sm:top-3">
              <MonsterAscensionStepper
                level={ascensionLevel}
                onChange={setAscensionLevel}
                serviceLocale={serviceLocale}
                prominent
              />
            </div>
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
            <CharacterStageHealthBar
              maxHp={character.startingHp}
              ascensionLevel={ascensionLevel}
              serviceLocale={serviceLocale}
              ascensionHealLabel={detailLabels.ascensionHeal}
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
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.resourceKind}</div>
                  <div className="font-game-title text-sm font-bold" style={{ color: characterColor }}>
                    {serviceLocale === "ko" ? "캐릭터" : "Character"}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
                <InfoMetric label={detailLabels.stats.hp} value={character.startingHp} color={characterColor} />
                <InfoMetric label={detailLabels.stats.gold} value={character.startingGold} />
                <InfoMetric label={detailLabels.stats.energy} value={character.maxEnergy} />
                {character.orbSlots !== null && (
                  <InfoMetric label={detailLabels.stats.orbs} value={character.orbSlots} color={characterColor} />
                )}
              </dl>
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

          {quoteRows.length > 0 && (
            <InfoRailSection title={detailLabels.gameText}>
              <div className="space-y-2 font-game-text text-xs leading-relaxed text-gray-400">
                <p>{detailLabels.gameTextIntro}</p>
                {quoteRows.map((quote) => (
                  <div key={`${character.id}-quote-${quote.id}`} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 font-game-title text-sm font-bold text-gray-200">
                      <Sparkles className="h-3.5 w-3.5 text-yellow-300" aria-hidden />
                      <span>{quote.title}</span>
                    </div>
                    <p className="mb-2 text-[11px] leading-relaxed text-gray-500">{quote.description}</p>
                    <div className="text-gray-300">
                      {entities ? (
                        <RichDescription
                          description={quote.text}
                          entities={entities}
                          excludeEntityTerms={excludeSelf}
                          excludeEntityTypes={CHARACTER_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                        />
                      ) : (
                        <DescriptionText description={quote.text} />
                      )}
                    </div>
                  </div>
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

function CharacterStageHealthBar({
  maxHp,
  ascensionLevel,
  serviceLocale,
  ascensionHealLabel,
}: {
  maxHp: number;
  ascensionLevel: number;
  serviceLocale: ServiceLocale;
  ascensionHealLabel: string;
}) {
  const ascended = ascensionLevel >= CHARACTER_WEARY_TRAVELER_ASCENSION_LEVEL;
  const currentHp = ascended ? Math.round(maxHp * CHARACTER_ASCENDED_HP_PREVIEW_RATIO) : maxHp;
  const fillRatio = Math.max(0, Math.min(1, currentHp / Math.max(maxHp, 1)));
  const hpLabel = `${currentHp}/${maxHp}`;
  const ariaLabel = serviceLocale === "ko" ? `체력 ${hpLabel}` : `HP ${hpLabel}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex flex-col items-center gap-1 px-8">
      <span
        className="relative inline-flex h-7 w-full min-w-48 max-w-80 items-center justify-center overflow-visible"
        aria-label={ariaLabel}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 top-1/2 h-[10px] -translate-y-1/2 bg-[#4d5a61] shadow-[0_2px_3px_rgba(0,0,0,0.72)]"
          style={{ clipPath: HEALTH_BAR_CLIP_PATH }}
        >
          <span
            className="absolute inset-[2px] bg-[#071a1a]"
            style={{ clipPath: HEALTH_BAR_CLIP_PATH }}
          />
          <span
            className="absolute inset-y-[2px] left-[2px] right-[2px] origin-left bg-gradient-to-b from-[#ff6258] via-[#F1373E] to-[#b11219] shadow-[inset_0_1px_0_rgba(255,153,132,0.72),inset_0_-1px_0_rgba(92,0,0,0.7)]"
            style={{ clipPath: HEALTH_BAR_CLIP_PATH, transform: `scaleX(${fillRatio})` }}
          />
        </span>
        <span
          className="relative z-10 font-game-title text-lg font-black leading-none text-[#fff8db]"
          style={{ textShadow: "0 2px 0 #900000, 1px 1px 0 #900000, -1px 1px 0 #900000, 0 0 4px #000" }}
        >
          {hpLabel}
        </span>
      </span>
      {ascended && (
        <span className="rounded bg-black/60 px-2 py-0.5 font-game-text text-[10px] font-bold text-blue-200 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          {ascensionHealLabel}
        </span>
      )}
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
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(scroller.scrollLeft > 1);
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    updateScrollState();
    if (!scroller) return undefined;

    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [groups.length, updateScrollState]);

  const scrollAncientsBy = useCallback((direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * Math.max(96, scroller.clientWidth * 0.72),
      behavior: "smooth",
    });
  }, []);

  const handleAncientWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    scroller.scrollBy({ left: event.deltaY, behavior: "smooth" });
  }, []);

  if (!activeGroup) {
    return <p className="font-game-text text-sm text-gray-500">{serviceLocale === "ko" ? "대사 데이터가 없습니다." : "No dialogue data."}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            aria-label={serviceLocale === "ko" ? "이전 고대의 존재" : "Previous Ancient"}
            onClick={() => scrollAncientsBy(-1)}
            className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-transform hover:scale-110"
          >
            <Image
              src="/images/sts2/ui/settings_tiny_left_arrow.png"
              alt=""
              width={32}
              height={32}
              className="object-contain"
            />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            aria-label={serviceLocale === "ko" ? "다음 고대의 존재" : "Next Ancient"}
            onClick={() => scrollAncientsBy(1)}
            className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-transform hover:scale-110"
          >
            <Image
              src="/images/sts2/ui/settings_tiny_right_arrow.png"
              alt=""
              width={32}
              height={32}
              className="object-contain"
            />
          </button>
        )}
        <div
          ref={scrollerRef}
          onWheel={handleAncientWheel}
          className="mx-7 flex gap-1.5 overflow-x-auto scroll-smooth pb-1 sm:mx-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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

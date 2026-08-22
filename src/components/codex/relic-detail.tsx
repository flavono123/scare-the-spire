"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import {
  CodexAncient,
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
  RELIC_RARITY_COLORS,
  characterOutlineFilter,
  getCharacterColor,
  CHARACTER_COLORS,
  type RelicPool,
  type RelicFilterPool,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import { RelatedResourceLinks } from "./entity-reference-links";
import { CardSideTipsAnchor } from "./card-keyword-tip-stack";
import { GameCheckboxToggle, GameWaxCycleToggle, type GameWaxCycleValue } from "./game-checkbox";
import { RelicInspectSlab } from "./relic-inspect-slab";
import { RichDescription } from "./rich-description";
import { getRelatedAncientIdsForRelic, getRelatedCardIdsForRelic, getRelatedEnchantmentIdsForRelic, getRelatedEventIdsForRelic, getRelatedPowerIdsForRelic } from "@/lib/codex-references";
import { STS2ChangeHistory } from "./sts2-change-history";
import {
  composeRelicDetailFilters,
  resolveRelicArtFilterMode,
  type RelicArtFilterSource,
} from "@/lib/relic-art-filters";
import { getRelicArtVariants } from "@/lib/relic-art-variants-catalog";
import {
  createCardSideTipCatalog,
  type CardSideTipCatalogSources,
} from "@/lib/card-side-tip-catalog";
import { collectRelicSideTips } from "@/lib/relic-side-tips";

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
      className="group rounded-lg border border-border bg-compendium-rail px-4 py-3"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
        <span>{title}</span>
        <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function getRelicDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        gameText: "게임 문구",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        gameText: "Game text",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

interface RelicDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  relic: CodexRelic;
  poolLabels: Record<RelicPool, string>;
  initialVariant?: RelicPool;
  initialShowBeta?: boolean;
  onClose?: () => void;
  /** Cross-reference entities — when provided, descriptions become rich. */
  entities?: EntityInfo[];
  relatedCards?: CodexCard[];
  relatedEvents?: CodexEvent[];
  relatedAncients?: CodexAncient[];
  relatedEnchantments?: CodexEnchantment[];
  relatedPowers?: CodexPower[];
  relatedMonsters?: CodexMonster[];
  relatedPotions?: CodexPotion[];
  tipCatalogSources?: CardSideTipCatalogSources;
  tipCatalogCards?: CodexCard[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

// Game order: 아이언클래드, 사일런트, 리젠트, 네크로바인더, 디펙트
const VARIANT_ORDER: RelicPool[] = ["ironclad", "silent", "regent", "necrobinder", "defect"];
const RELIC_DESCRIPTION_EXCLUDED_ENTITY_TYPES = new Set<EntityInfo["type"]>(["epoch"]);
export function RelicDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  relic,
  poolLabels,
  initialVariant,
  initialShowBeta = false,
  onClose,
  entities,
  relatedCards = [],
  relatedEvents = [],
  relatedAncients = [],
  relatedEnchantments = [],
  relatedPowers = [],
  relatedMonsters = [],
  relatedPotions = [],
  tipCatalogSources,
  tipCatalogCards,
  patches,
  changes,
  versionDiffs,
}: RelicDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getRelicDetailLabels(serviceLocale);
  // Don't link the relic to itself in its own description
  const excludeSelf = useMemo(
    () => new Set([relic.name, relic.nameEn]),
    [relic.name, relic.nameEn],
  );

  const variantPools = relic.variantImageUrls
    ? VARIANT_ORDER.filter((p) => relic.variantImageUrls![p])
    : [];
  const iconVariants = relic.iconVariants ?? [];
  const cornucopiaVariant = iconVariants.find((v) => v.id === "cornucopia") ?? null;
  const noCornucopiaVariant = iconVariants.find((v) => v.id === "no-cornucopia") ?? null;
  const hasCornucopiaToggle = Boolean(cornucopiaVariant && noCornucopiaVariant);
  const [selectedVariant, setSelectedVariant] = useState<RelicPool>(
    initialVariant && relic.variantImageUrls?.[initialVariant] ? initialVariant : variantPools[0] ?? relic.pool,
  );
  const [showCornucopia, setShowCornucopia] = useState(true);
  const [waxCycle, setWaxCycle] = useState<GameWaxCycleValue>("off");
  const [showUsedUp, setShowUsedUp] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  /** Last-clicked art family wins when wax and used-up/disabled can both be on. */
  const [artFilterSource, setArtFilterSource] = useState<RelicArtFilterSource>(null);
  const [showBeta, setShowBeta] = useState(initialShowBeta && Boolean(relic.betaImageUrl));
  const [commentCount, setCommentCount] = useState(0);
  const [artToggleRelicId, setArtToggleRelicId] = useState(relic.id);
  if (relic.id !== artToggleRelicId) {
    setArtToggleRelicId(relic.id);
    setWaxCycle("off");
    setShowUsedUp(false);
    setShowDisabled(false);
    setArtFilterSource(null);
    setShowCornucopia(true);
  }

  const artVariants = useMemo(() => getRelicArtVariants(relic.id), [relic.id]);

  const selectedIconVariant = hasCornucopiaToggle
    ? (showCornucopia ? cornucopiaVariant : noCornucopiaVariant)
    : null;

  const displayImageUrl = showBeta && relic.betaImageUrl
    ? relic.betaImageUrl
    : selectedIconVariant?.imageUrl
    ?? (relic.variantImageUrls
      ? relic.variantImageUrls[selectedVariant] ?? null
      : relic.imageUrl);
  const displayOutlinePool = showBeta && relic.betaImageUrl
    ? relic.pool
    : selectedIconVariant
    ? relic.pool
    : relic.variantImageUrls
    ? selectedVariant
    : relic.pool;

  const statusFilterOn = showUsedUp || showDisabled;
  const waxFilterOn = waxCycle !== "off";
  const artFilterMode = resolveRelicArtFilterMode({
    betaOverrides: Boolean(showBeta && relic.betaImageUrl),
    source: artFilterSource,
    waxCycle,
    statusOn: statusFilterOn,
  });
  // Character-colored outlines (e.g. ironclad #f87171) make melted look vivid red;
  // keep a neutral shadow whenever an art filter is active.
  const outlineFilter = artFilterMode === "none"
    ? (characterOutlineFilter(displayOutlinePool) ?? "drop-shadow(0 4px 8px rgba(0,0,0,0.5))")
    : "drop-shadow(0 4px 8px rgba(0,0,0,0.65))";
  const displayFilter = composeRelicDetailFilters(artFilterMode, outlineFilter);

  const onWaxCycleChange = (next: GameWaxCycleValue) => {
    setWaxCycle(next);
    if (next !== "off") setArtFilterSource("wax");
    else setArtFilterSource(statusFilterOn ? "status" : null);
  };
  const onUsedUpChange = (checked: boolean) => {
    setShowUsedUp(checked);
    if (checked) setArtFilterSource("status");
    else setArtFilterSource(waxFilterOn ? "wax" : null);
  };
  const onDisabledChange = (checked: boolean) => {
    setShowDisabled(checked);
    if (checked) setArtFilterSource("status");
    else setArtFilterSource(waxFilterOn ? "wax" : null);
  };

  const relicToggles = serviceText.relicsView.toggles;

  const tipCatalog = useMemo(
    () => tipCatalogSources
      ? createCardSideTipCatalog({
        sources: tipCatalogSources,
        powers: relatedPowers,
        cards: tipCatalogCards ?? relatedCards,
        monsters: relatedMonsters,
      })
      : null,
    [tipCatalogSources, relatedPowers, tipCatalogCards, relatedCards, relatedMonsters],
  );
  const potionsById = useMemo(
    () => new Map(relatedPotions.map((potion) => [potion.id, potion])),
    [relatedPotions],
  );
  const enchantmentsById = useMemo(
    () => new Map(relatedEnchantments.map((enchantment) => [enchantment.id, enchantment])),
    [relatedEnchantments],
  );
  const sideTips = useMemo(() => {
    if (!tipCatalog) return [];
    return collectRelicSideTips(relic, tipCatalog, {
      includeSelf: false,
      potionsById,
      enchantmentsById,
    });
  }, [relic, tipCatalog, potionsById, enchantmentsById]);

  const rarityColor = RELIC_RARITY_COLORS[relic.rarity];
  const rarityLabel = gameUi.relicCollection.rarities[relic.rarity].label;
  const poolColor = relic.pool !== "shared" ? getCharacterColor(relic.pool) : undefined;
  const relatedCardTargets = getRelatedCardIdsForRelic(relic.id).map((cardId) => {
    const relatedCard = relatedCards.find((card) => card.id === cardId) ?? null;
    const href = `/compendium/cards/${cardId.toLowerCase()}`;
    const title = relatedCard?.name ?? cardId;
    return {
      id: cardId,
      href,
      title,
      entity: {
        id: cardId,
        nameEn: relatedCard?.nameEn ?? title,
        nameKo: title,
        imageUrl: relatedCard?.imageUrl ?? null,
        href,
        color: relatedCard?.color ?? "card",
        type: "card" as const,
        cardData: relatedCard ?? undefined,
      },
    };
  });
  const relatedEventTargets = getRelatedEventIdsForRelic(relic.id).map((eventId) => {
    const relatedEvent = relatedEvents.find((event) => event.id === eventId) ?? null;
    const href = `/compendium/events/${eventId.toLowerCase()}`;
    const title = relatedEvent?.name ?? eventId;
    return {
      id: eventId,
      href,
      title,
      entity: {
        id: eventId,
        nameEn: relatedEvent?.nameEn ?? title,
        nameKo: title,
        imageUrl: relatedEvent?.imageUrl ?? null,
        href,
        color: "event",
        type: "event" as const,
        eventData: relatedEvent ?? undefined,
      },
    };
  });
  const relatedAncientTargets = getRelatedAncientIdsForRelic(relic.id, relatedAncients).map((ancientId) => {
    const relatedAncient = relatedAncients.find((ancient) => ancient.id === ancientId) ?? null;
    const href = `/compendium/ancients/${ancientId.toLowerCase()}`;
    const title = relatedAncient?.name ?? ancientId;
    return {
      id: ancientId,
      href,
      title,
      entity: {
        id: ancientId,
        nameEn: relatedAncient?.nameEn ?? title,
        nameKo: title,
        imageUrl: relatedAncient?.imageUrl ?? null,
        href,
        color: relatedAncient?.act ?? "ancient",
        type: "ancient" as const,
        ancientData: relatedAncient ?? undefined,
      },
    };
  });
  const relatedEnchantmentTargets = getRelatedEnchantmentIdsForRelic(relic, relatedEnchantments).map((enchantmentId) => {
    const relatedEnchantment = relatedEnchantments.find((enchantment) => enchantment.id === enchantmentId) ?? null;
    const href = `/compendium/enchantments/${enchantmentId.toLowerCase()}`;
    const title = relatedEnchantment?.name ?? enchantmentId;
    return {
      id: enchantmentId,
      href,
      title,
      entity: {
        id: enchantmentId,
        nameEn: relatedEnchantment?.nameEn ?? title,
        nameKo: title,
        imageUrl: relatedEnchantment?.imageUrl ?? null,
        href,
        color: relatedEnchantment?.cardType ?? "Any",
        type: "enchantment" as const,
        enchantmentData: relatedEnchantment ?? undefined,
      },
    };
  });
  const relatedPowerTargets = getRelatedPowerIdsForRelic(relic, relatedPowers).map((powerId) => {
    const relatedPower = relatedPowers.find((power) => power.id === powerId) ?? null;
    const href = `/compendium/powers/${powerId.toLowerCase()}`;
    const title = relatedPower?.name ?? powerId;
    return {
      id: powerId,
      href,
      title,
      entity: {
        id: powerId,
        nameEn: relatedPower?.nameEn ?? title,
        nameKo: title,
        imageUrl: relatedPower?.imageUrl ?? null,
        href,
        color: relatedPower?.type ?? "power",
        type: "power" as const,
        powerData: relatedPower ?? undefined,
      },
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/relics", serviceLocale)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[22rem] flex-col items-center justify-center gap-5 py-4">
          <CardSideTipsAnchor
            mode="always"
            preferSide="right"
            tips={sideTips}
            className="w-full max-w-[28rem]"
          >
            <RelicInspectSlab
              rarity={relic.rarity}
              rarityLabel={rarityLabel}
              title={relic.name}
              art={displayImageUrl ? (
                <Image
                  src={displayImageUrl}
                  alt={relic.name}
                  width={160}
                  height={160}
                  className="relative z-[1] h-[62%] w-[62%] object-contain"
                  style={displayFilter ? { filter: displayFilter } : undefined}
                />
              ) : (
                <div className="relative z-[1] flex h-[62%] w-[62%] items-center justify-center text-2xl text-gray-600">
                  ?
                </div>
              )}
              description={entities ? (
                <RichDescription
                  description={relic.description}
                  entities={entities}
                  excludeEntityTerms={excludeSelf}
                  excludeEntityTypes={RELIC_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                  className="block"
                />
              ) : (
                <DescriptionText description={relic.description} className="block" />
              )}
              flavor={relic.flavor ? (
                entities ? (
                  <RichDescription
                    description={relic.flavor}
                    entities={entities}
                    excludeEntityTerms={excludeSelf}
                    excludeEntityTypes={RELIC_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                  />
                ) : (
                  <DescriptionText description={relic.flavor} />
                )
              ) : undefined}
            />
          </CardSideTipsAnchor>

          <div className="flex flex-col items-center gap-3">
            {variantPools.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {variantPools.map((pool) => {
                  const isSelected = pool === selectedVariant;
                  const color = CHARACTER_COLORS[pool] ?? "#888";
                  return (
                    <button
                      key={pool}
                      onClick={() => setSelectedVariant(pool)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? "border-current bg-current/15"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                      style={{ color }}
                    >
                      {poolLabels[pool]}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col items-center gap-1.5">
              {hasCornucopiaToggle && (
                <GameCheckboxToggle
                  checked={showCornucopia}
                  onCheckedChange={setShowCornucopia}
                  label={relicToggles.cornucopia}
                  size="md"
                />
              )}

              {artVariants.wax && (
                <GameWaxCycleToggle
                  value={waxCycle}
                  onValueChange={onWaxCycleChange}
                  waxLabel={relicToggles.wax}
                  meltedLabel={relicToggles.melted}
                  size="md"
                />
              )}

              {artVariants.usedUp && (
                <GameCheckboxToggle
                  checked={showUsedUp}
                  onCheckedChange={onUsedUpChange}
                  label={relicToggles.usedUp}
                  size="md"
                />
              )}

              {artVariants.disabled && (
                <GameCheckboxToggle
                  checked={showDisabled}
                  onCheckedChange={onDisabledChange}
                  label={relicToggles.disabled}
                  size="md"
                />
              )}

              {relic.betaImageUrl && (
                <GameCheckboxToggle
                  checked={showBeta}
                  onCheckedChange={setShowBeta}
                  label={serviceText.cardsView.toggles.betaArt}
                  size="md"
                />
              )}
            </div>
          </div>
        </section>

        <aside data-relic-detail-meta className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill
                  value={rarityLabel}
                  color={rarityColor}
                />
                {relic.pool !== "shared" ? (
                  <MetaPill
                    value={poolLabels[relic.pool as RelicFilterPool] ?? relic.pool}
                    color={poolColor}
                  />
                ) : (
                  <MetaPill value={poolLabels.shared} />
                )}
              </div>
              {relic.nameEn !== relic.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-foreground">{relic.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <RelatedResourceLinks
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            groups={[
              { kind: "card", targets: relatedCardTargets },
              { kind: "event", targets: relatedEventTargets },
              { kind: "enchantment", targets: relatedEnchantmentTargets },
              { kind: "power", targets: relatedPowerTargets },
              { kind: "ancient", targets: relatedAncientTargets },
            ]}
          />

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="relic"
              entityId={relic.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              introducedInPatch={relic.introducedInPatch}
              deprecatedInPatch={relic.deprecatedInPatch}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("relic", relic.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

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
import { EntityReferenceGroupLinks } from "./entity-reference-links";
import { GameHoverTip } from "./hover-tip";
import { GameCheckboxToggle } from "./game-checkbox";
import { RichDescription } from "./rich-description";
import { getRelatedAncientIdsForRelic, getRelatedCardIdsForRelic, getRelatedEnchantmentIdsForRelic, getRelatedEventIdsForRelic, getRelatedPowerIdsForRelic } from "@/lib/codex-references";
import { STS2ChangeHistory } from "./sts2-change-history";

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
      className="group rounded-lg border border-white/10 bg-black/20 px-4 py-3"
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
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

// Game order: 아이언클래드, 사일런트, 리젠트, 네크로바인더, 디펙트
const VARIANT_ORDER: RelicPool[] = ["ironclad", "silent", "regent", "necrobinder", "defect"];
const RELIC_DESCRIPTION_EXCLUDED_ENTITY_TYPES = new Set<EntityInfo["type"]>(["epoch"]);
export function RelicDetail({ serviceLocale, gameUi, backToListTitle, relic, poolLabels, initialVariant, initialShowBeta = false, onClose, entities, relatedCards = [], relatedEvents = [], relatedAncients = [], relatedEnchantments = [], relatedPowers = [], patches, changes, versionDiffs }: RelicDetailProps) {
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
  const [selectedVariant, setSelectedVariant] = useState<RelicPool>(
    initialVariant && relic.variantImageUrls?.[initialVariant] ? initialVariant : variantPools[0] ?? relic.pool,
  );
  const [showBeta, setShowBeta] = useState(initialShowBeta && Boolean(relic.betaImageUrl));
  const [commentCount, setCommentCount] = useState(0);

  const displayImageUrl = showBeta && relic.betaImageUrl
    ? relic.betaImageUrl
    : relic.variantImageUrls
    ? relic.variantImageUrls[selectedVariant] ?? null
    : relic.imageUrl;
  const displayOutlinePool = showBeta && relic.betaImageUrl
    ? relic.pool
    : relic.variantImageUrls ? selectedVariant : relic.pool;

  const rarityColor = RELIC_RARITY_COLORS[relic.rarity];
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
          <div className="flex w-full flex-col items-center justify-center gap-5 md:flex-row md:items-center">
            <div className="flex shrink-0 flex-col items-center gap-3">
              <div className="flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
                {displayImageUrl ? (
                  <Image
                    src={displayImageUrl}
                    alt={relic.name}
                    width={160}
                    height={160}
                    className="h-full w-full object-contain"
                    style={{
                      filter: characterOutlineFilter(displayOutlinePool) ?? "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-gray-600">
                    ?
                  </div>
                )}
              </div>

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

              {relic.betaImageUrl && (
                <GameCheckboxToggle
                  checked={showBeta}
                  onCheckedChange={setShowBeta}
                  label={serviceText.cardsView.toggles.betaArt}
                  size="md"
                />
              )}
            </div>

            <GameHoverTip
              title={relic.name}
              className="w-full max-w-[23rem]"
              style={{ minWidth: 280 }}
            >
              {entities ? (
                <RichDescription
                  description={relic.description}
                  entities={entities}
                  excludeEntityTerms={excludeSelf}
                  excludeEntityTypes={RELIC_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                  className="block text-left"
                />
              ) : (
                <DescriptionText description={relic.description} className="block text-left" />
              )}
            </GameHoverTip>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill
                  value={gameUi.relicCollection.rarities[relic.rarity].label}
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
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{relic.nameEn}</div>
                </div>
              )}
              {relic.flavor && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.gameText}</div>
                  <p className="font-game-text text-xs italic leading-relaxed text-gray-500">
                    {entities ? (
                      <RichDescription
                        description={relic.flavor}
                        entities={entities}
                        excludeEntityTerms={excludeSelf}
                        excludeEntityTypes={RELIC_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                      />
                    ) : (
                      <DescriptionText description={relic.flavor} />
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
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

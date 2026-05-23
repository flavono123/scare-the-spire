"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexPotion,
  CodexPower,
  CodexRelic,
  ENCHANTMENT_CARD_TYPE_CONFIG,
  type EnchantmentCardTypeFilter,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import {
  getRelatedCardIdsForEnchantment,
  getRelatedEventIdsForEnchantment,
  getRelatedPotionIdsForEnchantment,
  getRelatedPowerIdsForEnchantment,
  getRelatedRelicIdsForEnchantment,
} from "@/lib/codex-references";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { GameHoverTip } from "./hover-tip";
import { RichDescription } from "./rich-description";
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

interface EnchantmentDetailProps {
  serviceLocale: ServiceLocale;
  gameUi?: CodexGameUiLabels;
  backToListTitle: string;
  enchantment: CodexEnchantment;
  onClose?: () => void;
  /** Cross-reference entities — when provided, descriptions become rich. */
  entities?: EntityInfo[];
  /** Cards that directly create or reference this enchantment. */
  cards?: CodexCard[];
  /** Events that can grant or reference this enchantment. */
  events?: CodexEvent[];
  /** Potions that share this enchantment's game mechanic. */
  potions?: CodexPotion[];
  /** Powers referenced by this enchantment's game text. */
  powers?: CodexPower[];
  /** All relics, used to surface ones that grant this enchantment. */
  relics?: CodexRelic[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

function getEnchantmentDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        cardText: "카드 텍스트",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        cardText: "Card text",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

export function EnchantmentDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  enchantment,
  onClose,
  entities,
  cards = [],
  events = [],
  potions = [],
  powers = [],
  relics,
  patches,
  changes,
  versionDiffs,
}: EnchantmentDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getEnchantmentDetailLabels(serviceLocale);
  const cardTypeFilter: EnchantmentCardTypeFilter = enchantment.cardType ?? "Any";
  const cardTypeConfig = ENCHANTMENT_CARD_TYPE_CONFIG[cardTypeFilter];
  const [commentCount, setCommentCount] = useState(0);

  const relatedRelics = useMemo(() => {
    if (!relics) return [];
    const relicById = new Map(relics.map((relic) => [relic.id, relic]));
    return getRelatedRelicIdsForEnchantment(enchantment.id, relics, [enchantment])
      .map((relicId) => relicById.get(relicId))
      .filter((relic): relic is CodexRelic => Boolean(relic))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [relics, enchantment]);

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const relatedCardTargets = getRelatedCardIdsForEnchantment(enchantment.id)
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CodexCard => Boolean(card))
    .map(cardToReferenceTarget);
  const relatedRelicTargets = relatedRelics.map(relicToReferenceTarget);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const relatedEventTargets = getRelatedEventIdsForEnchantment(enchantment.id)
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is CodexEvent => Boolean(event))
    .map(eventToReferenceTarget);
  const potionById = new Map(potions.map((potion) => [potion.id, potion]));
  const relatedPotionTargets = getRelatedPotionIdsForEnchantment(enchantment.id)
    .map((potionId) => potionById.get(potionId))
    .filter((potion): potion is CodexPotion => Boolean(potion))
    .map(potionToReferenceTarget);
  const powerById = new Map(powers.map((power) => [power.id, power]));
  const relatedPowerTargets = getRelatedPowerIdsForEnchantment(enchantment, powers)
    .map((powerId) => powerById.get(powerId))
    .filter((power): power is CodexPower => Boolean(power))
    .map(powerToReferenceTarget);

  const excludeSelf = useMemo(
    () => new Set([enchantment.name, enchantment.nameEn]),
    [enchantment.name, enchantment.nameEn],
  );

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/enchantments", serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
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
            <div className="flex h-32 w-32 shrink-0 items-center justify-center sm:h-40 sm:w-40">
              {enchantment.imageUrl ? (
                <Image
                  src={enchantment.imageUrl}
                  alt={enchantment.name}
                  width={160}
                  height={160}
                  className="h-full w-full object-contain drop-shadow-lg"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-gray-600">
                  ?
                </div>
              )}
            </div>

            <GameHoverTip
              title={enchantment.name}
              className="w-full max-w-[23rem]"
              style={{ minWidth: 280 }}
            >
              {entities ? (
                <RichDescription
                  description={enchantment.description}
                  entities={entities}
                  excludeEntityTerms={excludeSelf}
                  className="block text-left"
                />
              ) : (
                <DescriptionText description={enchantment.description} className="block text-left" />
              )}
            </GameHoverTip>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill
                  value={serviceText.labels.enchantmentCardTypes[cardTypeFilter].label}
                  color={cardTypeConfig.color}
                />
                {enchantment.isStackable && (
                  <MetaPill value={serviceText.enchantmentsView.stackable} color="#f59e0b" />
                )}
              </div>
              {enchantment.nameEn !== enchantment.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{enchantment.nameEn}</div>
                </div>
              )}
              {enchantment.extraCardText && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.cardText}</div>
                  <div className="font-game-text text-sm leading-relaxed text-gray-300">
                    {entities ? (
                      <RichDescription
                        description={enchantment.extraCardText}
                        entities={entities}
                        excludeEntityTerms={excludeSelf}
                      />
                    ) : (
                      <DescriptionText description={enchantment.extraCardText} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            groups={[
              { kind: "card", targets: relatedCardTargets },
              { kind: "relic", targets: relatedRelicTargets },
              { kind: "potion", targets: relatedPotionTargets },
              { kind: "power", targets: relatedPowerTargets },
              { kind: "event", targets: relatedEventTargets },
            ]}
            serviceLocale={serviceLocale}
          />

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="enchantment"
              entityId={enchantment.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("enchantment", enchantment.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

function cardToReferenceTarget(card: CodexCard): CodexReferenceTarget {
  const href = `/compendium/cards/${card.id.toLowerCase()}`;
  return {
    href,
    id: card.id,
    title: card.name,
    entity: {
      id: card.id,
      nameEn: card.nameEn,
      nameKo: card.name,
      imageUrl: card.imageUrl,
      href,
      color: card.color,
      type: "card",
      cardData: card,
    },
  };
}

function relicToReferenceTarget(relic: CodexRelic): CodexReferenceTarget {
  const href = `/compendium/relics/${relic.id.toLowerCase()}`;
  return {
    href,
    id: relic.id,
    title: relic.name,
    entity: {
      id: relic.id,
      nameEn: relic.nameEn,
      nameKo: relic.name,
      imageUrl: relic.imageUrl,
      href,
      color: relic.pool,
      type: "relic",
      relicData: relic,
    },
  };
}

function potionToReferenceTarget(potion: CodexPotion): CodexReferenceTarget {
  const href = `/compendium/potions/${potion.id.toLowerCase()}`;
  return {
    href,
    id: potion.id,
    title: potion.name,
    entity: {
      id: potion.id,
      nameEn: potion.nameEn,
      nameKo: potion.name,
      imageUrl: potion.imageUrl,
      href,
      color: potion.rarity,
      type: "potion",
      potionData: potion,
    },
  };
}

function powerToReferenceTarget(power: CodexPower): CodexReferenceTarget {
  const href = `/compendium/powers/${power.id.toLowerCase()}`;
  return {
    href,
    id: power.id,
    title: power.name,
    entity: {
      id: power.id,
      nameEn: power.nameEn,
      nameKo: power.name,
      imageUrl: power.imageUrl,
      href,
      color: power.type,
      type: "power",
      powerData: power,
    },
  };
}

function eventToReferenceTarget(event: CodexEvent): CodexReferenceTarget {
  const href = `/compendium/events/${event.id.toLowerCase()}`;
  return {
    href,
    id: event.id,
    title: event.name,
    entity: {
      id: event.id,
      nameEn: event.nameEn,
      nameKo: event.name,
      imageUrl: event.imageUrl,
      href,
      color: event.act ?? "event",
      type: "event",
      eventData: event,
    },
  };
}

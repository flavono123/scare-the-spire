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
  CodexAffliction,
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
  ENCHANTMENT_CARD_TYPE_CONFIG,
  type EnchantmentCardTypeFilter,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import {
  getRelatedMonsterIdsForAffliction,
  getRelatedCardIdsForEnchantment,
  getRelatedEventIdsForEnchantment,
  getRelatedPotionIdsForEnchantment,
  getRelatedPowerIdsForEnchantment,
  getRelatedRelicIdsForEnchantment,
} from "@/lib/codex-references";
import { getAfflictionCardTypeRestriction } from "@/lib/sts2-affliction-rules";
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

interface EnchantmentDetailBaseProps {
  serviceLocale: ServiceLocale;
  gameUi?: CodexGameUiLabels;
  backToListTitle: string;
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
  /** Monsters, used to surface those that apply this affliction. */
  monsters?: CodexMonster[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

type EnchantmentDetailProps = EnchantmentDetailBaseProps & (
  | { enchantment: CodexEnchantment; affliction?: never }
  | { affliction: CodexAffliction; enchantment?: never }
);

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

const ENCHANTMENT_DESCRIPTION_EXCLUDED_ENTITY_TYPES = new Set<EntityInfo["type"]>(["epoch"]);

export function EnchantmentDetail(props: EnchantmentDetailProps) {
  const {
    serviceLocale,
    gameUi,
    backToListTitle,
    onClose,
    entities,
    cards = [],
    events = [],
    potions = [],
    powers = [],
    relics,
    monsters = [],
    patches,
    changes,
    versionDiffs,
  } = props;
  const resourceKind = props.affliction ? "affliction" : "enchantment";
  const resource = props.affliction ?? props.enchantment;
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getEnchantmentDetailLabels(serviceLocale);
  const cardTypeFilter: EnchantmentCardTypeFilter = props.enchantment?.cardType ?? "Any";
  const cardTypeConfig = ENCHANTMENT_CARD_TYPE_CONFIG[cardTypeFilter];
  const afflictionCardType = props.affliction ? getAfflictionCardTypeRestriction(props.affliction) : null;
  const [commentCount, setCommentCount] = useState(0);

  const relatedRelics = useMemo(() => {
    if (!relics || !props.enchantment) return [];
    const relicById = new Map(relics.map((relic) => [relic.id, relic]));
    return getRelatedRelicIdsForEnchantment(props.enchantment.id, relics, [props.enchantment])
      .map((relicId) => relicById.get(relicId))
      .filter((relic): relic is CodexRelic => Boolean(relic))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [relics, props.enchantment]);

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const relatedCardTargets = props.enchantment ? getRelatedCardIdsForEnchantment(props.enchantment.id)
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CodexCard => Boolean(card))
    .map(cardToReferenceTarget) : [];
  const relatedRelicTargets = relatedRelics.map(relicToReferenceTarget);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const relatedEventTargets = props.enchantment ? getRelatedEventIdsForEnchantment(props.enchantment.id)
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is CodexEvent => Boolean(event))
    .map(eventToReferenceTarget) : [];
  const potionById = new Map(potions.map((potion) => [potion.id, potion]));
  const relatedPotionTargets = props.enchantment ? getRelatedPotionIdsForEnchantment(props.enchantment.id)
    .map((potionId) => potionById.get(potionId))
    .filter((potion): potion is CodexPotion => Boolean(potion))
    .map(potionToReferenceTarget) : [];
  const powerById = new Map(powers.map((power) => [power.id, power]));
  const relatedPowerTargets = props.enchantment ? getRelatedPowerIdsForEnchantment(props.enchantment, powers)
    .map((powerId) => powerById.get(powerId))
    .filter((power): power is CodexPower => Boolean(power))
    .map(powerToReferenceTarget) : [];
  const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
  const relatedMonsterTargets = props.affliction ? getRelatedMonsterIdsForAffliction(props.affliction.id, monsters)
    .map((monsterId) => monsterById.get(monsterId))
    .filter((monster): monster is CodexMonster => Boolean(monster))
    .map(monsterToReferenceTarget) : [];

  const excludeSelf = useMemo(
    () => new Set([resource.name, resource.nameEn]),
    [resource.name, resource.nameEn],
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
              {resource.imageUrl ? (
                <Image
                  src={resource.imageUrl}
                  alt={resource.name}
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
              title={resource.name}
              className="w-full max-w-[23rem]"
              style={{ minWidth: 280 }}
            >
              {entities ? (
                <RichDescription
                  description={resource.description}
                  entities={entities}
                  excludeEntityTerms={excludeSelf}
                  excludeEntityTypes={ENCHANTMENT_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                  className="block text-left"
                />
              ) : (
                <DescriptionText description={resource.description} className="block text-left" />
              )}
            </GameHoverTip>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {props.enchantment ? (
                  <MetaPill
                    value={serviceText.labels.enchantmentCardTypes[cardTypeFilter].label}
                    color={cardTypeConfig.color}
                  />
                ) : (
                  <>
                    <MetaPill value={serviceText.afflictions} color="#f59e0b" />
                    {afflictionCardType && (
                      <MetaPill value={serviceText.labels.cardTypes[afflictionCardType]} color={afflictionCardTypeColor(afflictionCardType)} />
                    )}
                  </>
                )}
                {resource.isStackable && (
                  <MetaPill value={serviceText.enchantmentsView.stackable} color="#f59e0b" />
                )}
              </div>
              {resource.nameEn !== resource.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{resource.nameEn}</div>
                </div>
              )}
              {resource.extraCardText && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.cardText}</div>
                  <div className="font-game-text text-sm leading-relaxed text-gray-300">
                    {entities ? (
                      <RichDescription
                        description={resource.extraCardText}
                        entities={entities}
                        excludeEntityTerms={excludeSelf}
                        excludeEntityTypes={ENCHANTMENT_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                      />
                    ) : (
                      <DescriptionText description={resource.extraCardText} />
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
              { kind: "monster", targets: relatedMonsterTargets },
            ]}
            serviceLocale={serviceLocale}
          />

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType={resourceKind}
              entityId={resource.id}
              changes={changes}
              versionDiffs={props.enchantment ? versionDiffs : undefined}
              patches={patches}
              introducedInPatch={resource.introducedInPatch}
              deprecatedInPatch={resource.deprecatedInPatch}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey(resourceKind, resource.id)}
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

function monsterToReferenceTarget(monster: CodexMonster): CodexReferenceTarget {
  const href = `/compendium/bestiary?monster=${monster.id.toLowerCase()}`;
  return {
    href,
    id: monster.id,
    title: monster.name,
    entity: {
      id: monster.id,
      nameEn: monster.nameEn,
      nameKo: monster.name,
      imageUrl: monster.bossImageUrl ?? monster.imageUrl,
      href,
      color: monster.type,
      type: "monster",
      monsterData: monster,
    },
  };
}

function afflictionCardTypeColor(cardType: CodexCard["type"]): string {
  if (cardType === "공격") return ENCHANTMENT_CARD_TYPE_CONFIG.Attack.color;
  if (cardType === "스킬") return ENCHANTMENT_CARD_TYPE_CONFIG.Skill.color;
  if (cardType === "파워") return "#c084fc";
  return "#b0b0b0";
}

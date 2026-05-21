"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  CodexEnchantment,
  CodexPotion,
  CodexEvent,
  PotionPool,
  POTION_RARITY_CONFIG,
  characterOutlineFilter,
  getCharacterColor,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { GameChoiceFrame } from "./event-choice-frame";
import { GameHoverTip } from "./hover-tip";
import { RichDescription } from "./rich-description";
import { STS2ChangeHistory } from "./sts2-change-history";
import { RichText } from "@/components/rich-text";
import {
  FUTURE_OF_POTIONS_EVENT_ID,
  FUTURE_OF_POTIONS_EVENT_NAME_KO,
  FUTURE_OF_POTIONS_EVENT_PATH,
  getFuturePotionChoicesForPotion,
  getRelatedEnchantmentIdsForPotion,
  getRelatedEventIdsForPotion,
} from "@/lib/codex-references";

function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

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

interface PotionDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  potion: CodexPotion;
  poolLabels: Record<PotionPool, string>;
  relatedEnchantments?: CodexEnchantment[];
  relatedEvents?: CodexEvent[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  onClose?: () => void;
}

function getPotionDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

export function PotionDetail({ serviceLocale, gameUi, backToListTitle, potion, poolLabels, relatedEnchantments = [], relatedEvents = [], patches, changes, versionDiffs, onClose, entities }: PotionDetailProps & { entities?: EntityInfo[] }) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getPotionDetailLabels(serviceLocale);
  const rarityConfig = POTION_RARITY_CONFIG[potion.rarity];
  const poolColor = potion.pool !== "shared" && potion.pool !== "event"
    ? getCharacterColor(potion.pool)
    : undefined;
  const futurePotionChoices = getFuturePotionChoicesForPotion(potion);
  const eventById = new Map(relatedEvents.map((event) => [event.id, event]));
  const relatedEventIds = dedupeIds([
    FUTURE_OF_POTIONS_EVENT_ID,
    ...getRelatedEventIdsForPotion(potion.id),
    ...(potion.rarity === "고급" ? ["POTION_COURIER"] : []),
  ]);
  const relatedEventTargets = relatedEventIds
    .map((eventId) => {
      const relatedEvent = eventById.get(eventId);
      const href = eventId === FUTURE_OF_POTIONS_EVENT_ID
        ? FUTURE_OF_POTIONS_EVENT_PATH
        : `/compendium/events/${eventId.toLowerCase()}`;
      const title = relatedEvent?.name ?? (eventId === FUTURE_OF_POTIONS_EVENT_ID ? FUTURE_OF_POTIONS_EVENT_NAME_KO : eventId);
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
          color: "event" as const,
          type: "event" as const,
          eventData: relatedEvent ?? undefined,
        },
      };
    });
  const enchantmentById = new Map(relatedEnchantments.map((enchantment) => [enchantment.id, enchantment]));
  const relatedEnchantmentTargets = getRelatedEnchantmentIdsForPotion(potion.id)
    .map((enchantmentId) => enchantmentById.get(enchantmentId))
    .filter((enchantment): enchantment is CodexEnchantment => Boolean(enchantment))
    .map(enchantmentToReferenceTarget);
  const potionCourierEvent = eventById.get("POTION_COURIER") ?? null;
  const potionCourierChoices = (potionCourierEvent?.options ?? []).filter((option) => (
    (potion.id === "FOUL_POTION" && option.id === "GRAB_POTIONS") ||
    (potion.rarity === "고급" && option.id === "RANSACK")
  ));
  const [commentCount, setCommentCount] = useState(0);
  const excludeSelf = useMemo(
    () => new Set([potion.name, potion.nameEn]),
    [potion.name, potion.nameEn],
  );

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/potions", serviceLocale)}
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
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400"
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
              <Image
                src={potion.imageUrl}
                alt={potion.name}
                width={160}
                height={160}
                className="h-full w-full object-contain"
                style={{
                  filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
                }}
              />
            </div>

            <GameHoverTip
              title={potion.name}
              className="w-full max-w-[23rem]"
              style={{ minWidth: 280 }}
            >
              {entities ? (
                <RichDescription
                  description={potion.description}
                  entities={entities}
                  excludeEntityTerms={excludeSelf}
                  className="block text-left"
                />
              ) : (
                <DescriptionText description={potion.description} className="block text-left" />
              )}
            </GameHoverTip>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill
                  value={gameUi.potionLab.rarities[potion.rarity].label}
                  color={rarityConfig.color}
                />
                <MetaPill
                  value={poolLabels[potion.pool]}
                  color={poolColor}
                />
              </div>
              {potion.nameEn !== potion.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{potion.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
            groups={[
              { kind: "event", targets: relatedEventTargets },
              { kind: "enchantment", targets: relatedEnchantmentTargets },
            ]}
            serviceLocale={serviceLocale}
          >
            <div className="space-y-2.5">
              {futurePotionChoices.map((choice) => (
                <GameChoiceFrame key={choice.id}>
                  <div className="font-game-text text-[17px] font-bold leading-[1.05] text-[#d8cb72]">
                    <RichText text={choice.title} />
                  </div>
                  <div className="font-game-text text-[16px] leading-[1.08] text-[#fff6e2]">
                    <RichText text={choice.description} />
                  </div>
                </GameChoiceFrame>
              ))}
              {potionCourierChoices.map((choice) => (
                <GameChoiceFrame key={`potion-courier-${choice.id}`}>
                  <div className="font-game-text text-[17px] font-bold leading-[1.05] text-[#d8cb72]">
                    <RichText text={choice.title} />
                  </div>
                  <div className="font-game-text text-[16px] leading-[1.08] text-[#fff6e2]">
                    <RichText text={choice.description} />
                  </div>
                </GameChoiceFrame>
              ))}
            </div>
          </EntityReferenceGroupLinks>

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="potion"
              entityId={potion.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("potion", potion.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

function enchantmentToReferenceTarget(enchantment: CodexEnchantment): CodexReferenceTarget {
  const href = `/compendium/enchantments/${enchantment.id.toLowerCase()}`;
  return {
    href,
    id: enchantment.id,
    title: enchantment.name,
    entity: {
      id: enchantment.id,
      nameEn: enchantment.nameEn,
      nameKo: enchantment.name,
      imageUrl: enchantment.imageUrl,
      href,
      color: enchantment.cardType ?? "Any",
      type: "enchantment",
      enchantmentData: enchantment,
    },
  };
}

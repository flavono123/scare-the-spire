"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  CodexPotion,
  CodexEvent,
  PotionPool,
  POTION_RARITY_CONFIG,
  characterOutlineFilter,
  getCharacterColor,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { EntityReferenceLinks } from "./entity-reference-links";
import { GameChoiceFrame } from "./event-choice-frame";
import { RichText } from "@/components/rich-text";
import {
  FUTURE_OF_POTIONS_EVENT_ID,
  FUTURE_OF_POTIONS_EVENT_NAME_KO,
  FUTURE_OF_POTIONS_EVENT_PATH,
  getFuturePotionChoicesForPotion,
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

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

interface PotionDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  potion: CodexPotion;
  poolLabels: Record<PotionPool, string>;
  relatedEvents?: CodexEvent[];
  onClose?: () => void;
}

export function PotionDetail({ serviceLocale, gameUi, backToListTitle, potion, poolLabels, relatedEvents = [], onClose }: PotionDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
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
  const potionCourierEvent = eventById.get("POTION_COURIER") ?? null;
  const potionCourierChoices = (potionCourierEvent?.options ?? []).filter((option) => (
    (potion.id === "FOUL_POTION" && option.id === "GRAB_POTIONS") ||
    (potion.rarity === "고급" && option.id === "RANSACK")
  ));

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
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

      {/* Large Potion Image */}
      <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
        <Image
          src={potion.imageUrl}
          alt={potion.name}
          width={160}
          height={160}
          className="w-full h-full object-contain"
          style={{
            filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
          }}
        />
      </div>

      {/* Potion Name */}
      <div className="text-center">
        <h1 className="font-game-title text-2xl font-bold text-gray-100">{potion.name}</h1>
        <p className="font-game-text text-sm text-gray-500">{potion.nameEn}</p>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge
          label={gameUi.common.rarity}
          value={gameUi.potionLab.rarities[potion.rarity].label}
          color={rarityConfig.color}
        />
        <StatBadge
          label={serviceText.potionsView.stats.source}
          value={poolLabels[potion.pool]}
          color={poolColor}
        />
      </div>

      {/* Description */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="font-game-text text-sm text-gray-200 leading-relaxed">
          <DescriptionText description={potion.description} />
        </div>
      </div>

      <EntityReferenceLinks
        kind="event"
        serviceLocale={serviceLocale}
        targets={relatedEventTargets}
      >
        <div className="space-y-2.5">
          {futurePotionChoices.map((choice) => (
            <GameChoiceFrame key={choice.id}>
              <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
                <RichText text={choice.title} />
              </div>
              <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
                <RichText text={choice.description} />
              </div>
            </GameChoiceFrame>
          ))}
          {potionCourierChoices.map((choice) => (
            <GameChoiceFrame key={`potion-courier-${choice.id}`}>
              <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
                <RichText text={choice.title} />
              </div>
              <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
                <RichText text={choice.description} />
              </div>
            </GameChoiceFrame>
          ))}
        </div>
      </EntityReferenceLinks>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">{serviceText.common.comments}</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("potion", potion.id)} />
      </div>
    </div>
  );
}

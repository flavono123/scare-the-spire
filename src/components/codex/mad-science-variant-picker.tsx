"use client";

import { useCallback, useState } from "react";
import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { RichText } from "@/components/rich-text";
import { withMadScienceVariantEntity } from "@/lib/all-entities";
import type { CodexCard } from "@/lib/codex-types";
import { cn } from "@/lib/utils";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import {
  getMadScienceVariantCard,
  getTinkerRiderIdsForType,
  MAD_SCIENCE_CARD_ID,
  MAD_SCIENCE_DEFAULT_VARIANT,
  replaceTinkerTemplateValues,
  resolveMadScienceVariant,
  TINKER_CARD_TYPE_TO_KO,
  TINKER_CARD_TYPES,
  TINKER_RIDER_CHOICE_LABELS,
  type MadScienceVariant,
} from "@/lib/tinker-time";
import { getCardTypeFilterIcon } from "./codex-filter-assets";
import { IconFilterButton } from "./codex-filters";

/** Card type icons (as in the card library filter) and the Tinker Time options of the chosen type. */
export function MadScienceVariantPicker({
  card,
  value,
  onChange,
  className,
}: {
  card: Pick<CodexCard, "madScienceLabels">;
  value: MadScienceVariant;
  onChange: (variant: MadScienceVariant) => void;
  className?: string;
}) {
  const labels = card.madScienceLabels;
  return (
    <div className={cn("space-y-2", className)} data-mad-science-variant-picker>
      <div className="flex justify-center gap-1.5" data-mad-science-type-picker>
        {TINKER_CARD_TYPES.map((cardType) => {
          const typeKo = TINKER_CARD_TYPE_TO_KO[cardType];
          return (
            <IconFilterButton
              key={cardType}
              icon={getCardTypeFilterIcon(typeKo)}
              label={labels?.typeLabels?.[cardType] ?? typeKo}
              active={value.cardType === cardType}
              onClick={() => onChange(resolveMadScienceVariant(cardType, value.riderId))}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5" data-mad-science-rider-picker>
        {getTinkerRiderIdsForType(value.cardType).map((riderId) => {
          const active = value.riderId === riderId;
          const description = replaceTinkerTemplateValues(labels?.riderChoiceDescriptions[riderId] ?? "");
          return (
            <button
              key={riderId}
              type="button"
              aria-pressed={active}
              title={description.replace(/\[[^\]]*\]/g, "")}
              onClick={() => onChange({ cardType: value.cardType, riderId })}
              className={cn(
                "rounded-md border px-2.5 py-1 font-game-text text-sm font-bold transition-colors",
                active
                  ? "border-primary bg-primary/20 text-[#d8cb72]"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/30",
              )}
            >
              <RichText text={labels?.riderChoiceLabels[riderId] ?? TINKER_RIDER_CHOICE_LABELS[riderId]} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Pickers list one Mad Science card. Picking it opens this step; confirming hands the picker the
 * card painted as the chosen variant, whose id (MAD_SCIENCE_ATTACK_VIOLENCE) is what posts store.
 */
export function useMadScienceVariantStep(onSelect: (entity: EntityInfo) => void) {
  const [pending, setPending] = useState<EntityInfo | null>(null);
  const select = useCallback((entity: EntityInfo) => {
    if (entity.type === "card" && entity.id === MAD_SCIENCE_CARD_ID && entity.cardData) setPending(entity);
    else onSelect(entity);
  }, [onSelect]);
  const confirm = useCallback((variant: MadScienceVariant) => {
    if (!pending) return;
    setPending(null);
    onSelect(withMadScienceVariantEntity(pending, variant));
  }, [onSelect, pending]);
  const cancel = useCallback(() => setPending(null), []);
  return { select, pending, confirm, cancel };
}

export function MadScienceVariantStep({
  entity,
  serviceLocale,
  onConfirm,
  onCancel,
  className,
}: {
  entity: EntityInfo;
  serviceLocale: ServiceLocale;
  onConfirm: (variant: MadScienceVariant) => void;
  onCancel: () => void;
  className?: string;
}) {
  const copy = serviceMessages[serviceLocale].madScienceVariant;
  const [variant, setVariant] = useState<MadScienceVariant>(MAD_SCIENCE_DEFAULT_VARIANT);
  if (!entity.cardData) return null;
  const card = getMadScienceVariantCard(entity.cardData, variant);
  return (
    <div
      className={cn("space-y-3 rounded-lg border border-primary/25 bg-black/40 p-3", className)}
      data-mad-science-variant-step
    >
      <div className="flex items-center gap-3">
        <div className="w-24 shrink-0">
          <FittedCardTile card={card} serviceLocale={serviceLocale} showUpgrade={false} showBeta={false} interactive={false} />
        </div>
        <MadScienceVariantPicker card={entity.cardData} value={variant} onChange={setVariant} className="min-w-0 flex-1" />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/30"
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(variant)}
          data-mad-science-variant-confirm
          className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25"
        >
          {copy.confirm}
        </button>
      </div>
    </div>
  );
}

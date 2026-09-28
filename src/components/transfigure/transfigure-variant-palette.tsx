"use client";

import { Crown, Plus, X } from "lucide-react";
import { FilterSection } from "@/components/codex/codex-filters";
import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import type { ServiceLocale } from "@/lib/i18n";
import { TRANSFIGURE_MAX_VARIANTS } from "@/lib/transfigure-types";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

export interface TransfigureVariantPaletteItem {
  uid: string;
  entity: EntityInfo;
  name: string;
  upgraded: boolean;
  blockMessage: string | null;
}

interface TransfigureVariantPaletteProps {
  items: TransfigureVariantPaletteItem[];
  activeIndex: number;
  serviceLocale: ServiceLocale;
  onSelect: (index: number) => void;
  onMakeRepresentative: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

export function TransfigureVariantPalette({
  items,
  activeIndex,
  serviceLocale,
  onSelect,
  onMakeRepresentative,
  onRemove,
  onAdd,
}: TransfigureVariantPaletteProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const typeLabels = compendiumTypeLabels(serviceLocale);
  const full = items.length >= TRANSFIGURE_MAX_VARIANTS;

  return (
    <div className="border-t border-border px-3 py-2" data-transfigure-variant-palette="">
      <FilterSection label={`${copy.variantsLabel} · ${items.length}/${TRANSFIGURE_MAX_VARIANTS}`}>
        <ol className="space-y-1">
          {items.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={item.uid}
                className={cn(
                  "group flex items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors",
                  active
                    ? "border-primary/45 bg-primary/10"
                    : "border-transparent hover:bg-muted/40",
                )}
                data-transfigure-variant-item={index}
                data-active={active ? "true" : undefined}
              >
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-current={active ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-black/25">
                    {item.entity.imageUrl ? (
                      <Image
                        src={item.entity.imageUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="max-h-7 max-w-7 object-contain"
                      />
                    ) : (
                      <span className="font-game-title text-xs font-bold text-primary/70">
                        {item.entity.nameKo.slice(0, 1)}
                      </span>
                    )}
                    <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-0.5 font-game-title text-[9px] tabular-nums text-muted-foreground ring-1 ring-border">
                      {index + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs font-semibold",
                        active ? "text-primary" : "text-foreground",
                      )}
                    >
                      {item.name}
                      {item.upgraded ? "+" : ""}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="truncate">
                        {typeLabels[item.entity.type] ?? item.entity.type}
                      </span>
                      {index === 0 && (
                        <span
                          className="shrink-0 rounded bg-primary/20 px-1 text-primary"
                          data-transfigure-variant-representative=""
                        >
                          {copy.representative}
                        </span>
                      )}
                    </span>
                  </span>
                  {item.blockMessage && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400"
                      title={item.blockMessage}
                      aria-label={item.blockMessage}
                      role="img"
                      data-transfigure-variant-invalid=""
                    />
                  )}
                </button>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => onMakeRepresentative(index)}
                    aria-label={`${copy.makeRepresentative}: ${item.name}`}
                    title={copy.makeRepresentative}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-60 transition-[color,opacity] hover:text-primary hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={copy.removeVariant.replace("{name}", item.name)}
                  title={copy.removeVariant.replace("{name}", item.name)}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-60 transition-[color,opacity] hover:text-red-300 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={onAdd}
          disabled={full}
          title={full
            ? copy.variantLimitReached.replace("{max}", String(TRANSFIGURE_MAX_VARIANTS))
            : undefined}
          className="mt-1.5 flex w-full items-center gap-1.5 rounded-md border border-dashed border-primary/25 px-2 py-1 text-left text-xs text-primary/70 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          data-transfigure-variant-add=""
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.addVariant}
        </button>
        {items.length > 1 && (
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            {copy.representativeHint}
          </p>
        )}
      </FilterSection>
    </div>
  );
}

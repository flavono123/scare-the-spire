"use client";

import { X } from "lucide-react";
import { ComboResourcePicker } from "@/components/combo/combo-resource-picker";
import { TinyCardToken } from "@/components/history-course/card-action-icon";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

export function CardConPanel({
  entities,
  onClose,
  onInsert,
}: {
  entities: EntityInfo[];
  onClose: () => void;
  onInsert: (entity: EntityInfo) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].cardCon;
  const commonCopy = serviceMessages[serviceLocale].codex.common;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            <TinyCardToken width={12} />
            <span>{copy.label}</span>
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {copy.hint}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-card-con-close=""
          aria-label={commonCopy.close}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      <ComboResourcePicker
        entities={entities}
        serviceLocale={serviceLocale}
        onSelect={onInsert}
        cardTiles
        embedded
        searchPlaceholder={copy.searchPlaceholder}
        panelLabel={copy.make}
      />
    </div>
  );
}

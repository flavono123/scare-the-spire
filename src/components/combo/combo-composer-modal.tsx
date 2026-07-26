"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { ComboEditor } from "./combo-editor";

interface ComboComposerModalProps {
  entities: EntityInfo[];
  placeholder: string;
  profileNickname: string;
  serviceLocale: ServiceLocale;
  onSubmit: (blocks: PostBlock[], nickname: string) => Promise<void>;
  onClose: () => void;
}

export function ComboComposerModal({
  entities,
  placeholder,
  profileNickname,
  serviceLocale,
  onSubmit,
  onClose,
}: ComboComposerModalProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-3 sm:py-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-composer-title"
        tabIndex={-1}
        data-combo-composer
        className="flex max-h-[calc(100svh-3rem)] w-full flex-col rounded-t-2xl border border-b-0 border-yellow-500/20 bg-[#08080f] shadow-[0_-18px_60px_rgba(0,0,0,0.6)] outline-none sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:border-b sm:shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
            <h2
              id="combo-composer-title"
              className="font-service text-sm font-semibold text-yellow-100"
            >
              {copy.create}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70"
            title={copy.close}
          >
            <X size={16} aria-hidden="true" />
            <span className="sr-only">{copy.close}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <ComboEditor
            entities={entities}
            placeholder={placeholder}
            profileNickname={profileNickname}
            serviceLocale={serviceLocale}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}

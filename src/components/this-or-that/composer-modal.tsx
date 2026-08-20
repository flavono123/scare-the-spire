"use client";

import { X } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ThisOrThatComposerForm } from "@/components/this-or-that/composer-form";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { GameLocale } from "@/lib/i18n";
import type { ThisOrThatResourceRef } from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";

export function ThisOrThatComposerModal({
  entities,
  gameLocale,
  placeholder,
  authReady,
  storageUnavailable,
  submitting,
  onSubmit,
  onClose,
}: {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  placeholder: string;
  authReady: boolean;
  storageUnavailable: boolean;
  submitting: boolean;
  onSubmit: (input: {
    left: ThisOrThatResourceRef;
    right: ThisOrThatResourceRef;
    reason: string;
  }) => Promise<boolean>;
  onClose: () => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].thisOrThat;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="font-service text-sm font-semibold text-zinc-200">{copy.create}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            title={copy.close}
          >
            <X size={16} />
            <span className="sr-only">{copy.close}</span>
          </button>
        </div>

        <ThisOrThatComposerForm
          entities={entities}
          gameLocale={gameLocale}
          placeholder={placeholder}
          authReady={authReady}
          storageUnavailable={storageUnavailable}
          submitting={submitting}
          onSubmit={async (input) => {
            const saved = await onSubmit(input);
            if (saved) onClose();
            return saved;
          }}
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}

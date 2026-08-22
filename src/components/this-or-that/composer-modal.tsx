"use client";

import type { EntityInfo } from "@/components/patch-note-renderer";
import { ServiceModalFrame } from "@/components/service-modal-frame";
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
    <ServiceModalFrame
      title={copy.create}
      titleId="this-or-that-composer-title"
      closeLabel={copy.close}
      onClose={onClose}
      overlayClassName="items-center px-3 py-6"
      panelClassName="max-h-[90vh] max-w-4xl rounded-lg border-b border-border bg-background shadow-2xl sm:rounded-lg"
      bodyClassName="p-0"
    >
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
    </ServiceModalFrame>
  );
}

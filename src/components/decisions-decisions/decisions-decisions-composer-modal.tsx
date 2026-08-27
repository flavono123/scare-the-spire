"use client";

import { ServiceModalFrame } from "@/components/service-modal-frame";
import {
  DecisionsDecisionsComposer,
  type DecisionsDecisionsComposerValues,
} from "@/components/decisions-decisions/decisions-decisions-composer";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type {
  DecisionsDecisionsPost,
  DecisionsDecisionsResourceRef,
} from "@/lib/decisions-decisions";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export function DecisionsDecisionsComposerModal({
  entities,
  entityMap,
  stamps,
  gameLocale,
  serviceLocale,
  presetLabels,
  submitLabel,
  profileNickname,
  hideNickname = false,
  initial,
  onSubmit,
  onClose,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  stamps: Record<string, DecisionsDecisionsResourceRef[]>;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  presetLabels: Record<string, string>;
  submitLabel: string;
  profileNickname: string;
  hideNickname?: boolean;
  initial?: DecisionsDecisionsPost | null;
  onSubmit: (values: DecisionsDecisionsComposerValues) => Promise<boolean>;
  onClose: () => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;

  return (
    <ServiceModalFrame
      title={initial ? copy.edit : copy.create}
      titleId="decisions-decisions-composer-title"
      closeLabel={copy.close}
      onClose={onClose}
      overlayClassName="items-center px-3 py-6"
      panelClassName="max-h-[90vh] max-w-6xl rounded-xl border-b border-border bg-background shadow-2xl sm:rounded-xl"
      showAccentDot
      titleClassName="spire-gold"
      panelDataAttribute="data-decisions-decisions-composer-modal"
    >
      <DecisionsDecisionsComposer
        entities={entities}
        entityMap={entityMap}
        stamps={stamps}
        gameLocale={gameLocale}
        serviceLocale={serviceLocale}
        presetLabels={presetLabels}
        submitLabel={submitLabel}
        profileNickname={profileNickname}
        hideNickname={hideNickname}
        initial={initial}
        onSubmit={onSubmit}
        embedded
      />
    </ServiceModalFrame>
  );
}

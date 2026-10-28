"use client";

import type { CompendiumLazyDataStatus } from "@/components/codex/use-compendium-data";
import { EntityGraphGate } from "@/components/entity-graph-gate";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ServiceModalFrame } from "@/components/service-modal-frame";
import type { PostBlock } from "@/lib/chemical-types";
import type { ComboPost } from "@/lib/combo-types";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { ComboEditor } from "./combo-editor";

interface ComboComposerModalProps {
  entities: EntityInfo[];
  /** The editor waits for the full entity graph when the caller loads it lazily. */
  entitiesStatus?: CompendiumLazyDataStatus;
  initialPost?: ComboPost | null;
  placeholder: string;
  profileNickname: string;
  serviceLocale: ServiceLocale;
  onSubmit: (blocks: PostBlock[], nickname: string) => Promise<void>;
  onClose: () => void;
}

export function ComboComposerModal({
  entities,
  entitiesStatus = "loaded",
  initialPost,
  placeholder,
  profileNickname,
  serviceLocale,
  onSubmit,
  onClose,
}: ComboComposerModalProps) {
  const copy = serviceMessages[serviceLocale].combo;

  return (
    <ServiceModalFrame
      title={initialPost ? copy.editTitle : copy.create}
      titleId="combo-composer-title"
      closeLabel={copy.close}
      onClose={onClose}
      showAccentDot
      titleClassName="text-primary"
      panelClassName="h-[calc(100svh-3rem)] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl"
      panelDataAttribute="data-combo-composer"
    >
      <EntityGraphGate
        status={entitiesStatus}
        serviceLocale={serviceLocale}
        unavailableTitle={copy.unavailableTitle}
      >
        <ComboEditor
          entities={entities}
          initialPost={initialPost}
          placeholder={placeholder}
          profileNickname={profileNickname}
          serviceLocale={serviceLocale}
          onSubmit={onSubmit}
        />
      </EntityGraphGate>
    </ServiceModalFrame>
  );
}

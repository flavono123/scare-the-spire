"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { CompendiumLazyDataStatus } from "@/components/codex/use-compendium-data";
import { EntityGraphGate } from "@/components/entity-graph-gate";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ServiceModalFrame } from "@/components/service-modal-frame";
import type { SaveTransfigurePostInput } from "@/hooks/use-transfigure-posts";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { TransfigureEditor } from "./transfigure-editor";

interface TransfigureComposerModalProps {
  entities: EntityInfo[];
  /** The editor waits for the full entity graph when the caller loads it lazily. */
  entitiesStatus?: CompendiumLazyDataStatus;
  gameLocale: GameLocale;
  initialPost?: TransfigurePost | null;
  profileNickname: string;
  serviceLocale: ServiceLocale;
  upgradeLabel: string;
  onSubmit: (
    input: Omit<SaveTransfigurePostInput, "activeUserId">,
  ) => Promise<void>;
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
  hideNickname?: boolean;
}

export function TransfigureComposerModal({
  entities,
  entitiesStatus = "loaded",
  gameLocale,
  initialPost,
  profileNickname,
  serviceLocale,
  upgradeLabel,
  onSubmit,
  onDelete,
  onClose,
  hideNickname = false,
}: TransfigureComposerModalProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const editorReady = entitiesStatus === "loaded";

  useEffect(() => {
    if (initialPost || !editorReady) return;
    dialogRef.current
      ?.querySelector<HTMLInputElement>(
        "[data-transfigure-resource-picker] input[type=\"search\"]",
      )
      ?.focus();
  }, [editorReady, initialPost]);

  const handleDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ServiceModalFrame
      title={initialPost ? copy.editTitle : copy.create}
      titleId="transfigure-composer-title"
      closeLabel={copy.close}
      onClose={onClose}
      showAccentDot
      titleClassName="spire-gold"
      panelClassName="max-h-[calc(100svh-1rem)] sm:max-h-[94vh] sm:max-w-6xl"
      dialogRef={dialogRef}
      headerTrailing={
        initialPost && onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-700/30 px-2.5 text-xs text-red-800 transition-colors hover:border-red-700/50 hover:bg-red-600/10 hover:text-red-900 focus-visible:outline focus-visible:outline-1 focus-visible:outline-red-700/70 disabled:cursor-wait disabled:opacity-50 dark:border-red-400/20 dark:text-red-300/80 dark:hover:border-red-300/40 dark:hover:bg-red-500/10 dark:hover:text-red-200"
          >
            <Trash2 size={14} />
            {copy.delete}
          </button>
        ) : null
      }
    >
      <EntityGraphGate
        status={entitiesStatus}
        serviceLocale={serviceLocale}
        unavailableTitle={copy.unavailableTitle}
      >
        <TransfigureEditor
          entities={entities}
          gameLocale={gameLocale}
          initialPost={initialPost}
          profileNickname={profileNickname}
          serviceLocale={serviceLocale}
          upgradeLabel={upgradeLabel}
          hideNickname={hideNickname}
          onSubmit={onSubmit}
        />
      </EntityGraphGate>
    </ServiceModalFrame>
  );
}

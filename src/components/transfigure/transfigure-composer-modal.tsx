"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { SaveTransfigurePostInput } from "@/hooks/use-transfigure-posts";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { TransfigureEditor } from "./transfigure-editor";

interface TransfigureComposerModalProps {
  entities: EntityInfo[];
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
}

export function TransfigureComposerModal({
  entities,
  gameLocale,
  initialPost,
  profileNickname,
  serviceLocale,
  upgradeLabel,
  onSubmit,
  onDelete,
  onClose,
}: TransfigureComposerModalProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const initialFocus = initialPost
      ? dialogRef.current
      : dialogRef.current?.querySelector<HTMLInputElement>(
        '[data-transfigure-resource-picker] input[type="search"]',
      );
    initialFocus?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialPost, onClose]);

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
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-3 sm:py-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfigure-composer-title"
        tabIndex={-1}
        className="flex max-h-[calc(100svh-1rem)] w-full flex-col rounded-t-2xl border border-b-0 border-yellow-500/20 bg-[#070a12] shadow-[0_-18px_60px_rgba(0,0,0,0.6)] outline-none sm:max-h-[94vh] sm:max-w-6xl sm:rounded-xl sm:border-b sm:shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EFC851] shadow-[0_0_8px_rgba(239,200,81,0.8)]" />
            <h2
              id="transfigure-composer-title"
              className="spire-gold font-service text-sm font-semibold"
            >
              {initialPost ? copy.editTitle : copy.create}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {initialPost && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-400/20 px-2.5 text-xs text-red-300/80 transition-colors hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-red-300/70 disabled:cursor-wait disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden="true" />
                {copy.delete}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-300/70"
              title={copy.close}
            >
              <X size={16} aria-hidden="true" />
              <span className="sr-only">{copy.close}</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <TransfigureEditor
            entities={entities}
            gameLocale={gameLocale}
            initialPost={initialPost}
            profileNickname={profileNickname}
            serviceLocale={serviceLocale}
            upgradeLabel={upgradeLabel}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}

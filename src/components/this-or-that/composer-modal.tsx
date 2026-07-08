"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  entityToThisOrThatRef,
  isSameThisOrThatResource,
  type ThisOrThatResourceRef,
} from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatResourcePicker } from "@/components/this-or-that/resource-picker";

export function ThisOrThatComposerModal({
  entities,
  placeholder,
  authReady,
  storageUnavailable,
  submitting,
  onSubmit,
  onClose,
}: {
  entities: EntityInfo[];
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
  const [leftEntity, setLeftEntity] = useState<EntityInfo | null>(null);
  const [rightEntity, setRightEntity] = useState<EntityInfo | null>(null);
  const [reason, setReason] = useState("");
  const leftRef = useMemo(() => leftEntity ? entityToThisOrThatRef(leftEntity) : null, [leftEntity]);
  const rightRef = useMemo(() => rightEntity ? entityToThisOrThatRef(rightEntity) : null, [rightEntity]);
  const trimmedReason = reason.trim();
  const canSubmit =
    authReady
    && !storageUnavailable
    && Boolean(leftRef)
    && Boolean(rightRef)
    && !isSameThisOrThatResource(leftRef, rightRef)
    && trimmedReason.length >= 2
    && trimmedReason.length <= 500
    && !submitting;

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leftRef || !rightRef || !canSubmit) return;
    const saved = await onSubmit({
      left: leftRef,
      right: rightRef,
      reason: trimmedReason,
    });
    if (saved) onClose();
  }, [canSubmit, leftRef, onClose, onSubmit, rightRef, trimmedReason]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-background shadow-2xl"
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ThisOrThatResourcePicker
              entities={entities}
              label={copy.leftLabel}
              value={leftEntity}
              onChange={setLeftEntity}
              placeholder={copy.searchPlaceholder}
              exclude={rightEntity}
            />
            <ThisOrThatResourcePicker
              entities={entities}
              label={copy.rightLabel}
              value={rightEntity}
              onChange={setRightEntity}
              placeholder={copy.searchPlaceholder}
              exclude={leftEntity}
            />
          </div>

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            maxLength={500}
            rows={4}
            className="min-h-28 w-full resize-y rounded-md border border-border/70 bg-zinc-900/70 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-yellow-500/40"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
          <span className={`font-mono text-xs ${trimmedReason.length > 500 ? "text-red-400" : "text-muted-foreground"}`}>
            {trimmedReason.length}/500
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 text-xs font-semibold text-yellow-300 transition-colors hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <EngagementSpinner size={14} />}
            {submitting ? "..." : copy.submit}
          </button>
        </div>
      </form>
    </div>
  );
}

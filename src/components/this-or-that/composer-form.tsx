"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { StoryWriteIcon } from "@/components/story-token-icon";
import { ThisOrThatResourcePicker } from "@/components/this-or-that/resource-picker";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { GameLocale } from "@/lib/i18n";
import {
  entityToThisOrThatRef,
  isSameThisOrThatResource,
  type ThisOrThatResourceRef,
} from "@/lib/this-or-that";
import { cn } from "@/lib/utils";
import { GameScrollArea } from "@/components/game-scroll-area";
import { serviceMessages } from "@/messages/service";

export function ThisOrThatComposerForm({
  entities,
  gameLocale,
  placeholder,
  authReady,
  storageUnavailable,
  submitting,
  onSubmit,
  className,
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
  className?: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const [leftEntity, setLeftEntity] = useState<EntityInfo | null>(null);
  const [rightEntity, setRightEntity] = useState<EntityInfo | null>(null);
  const [reason, setReason] = useState("");
  const leftRef = useMemo(
    () => (leftEntity ? entityToThisOrThatRef(leftEntity) : null),
    [leftEntity],
  );
  const rightRef = useMemo(
    () => (rightEntity ? entityToThisOrThatRef(rightEntity) : null),
    [rightEntity],
  );
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

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leftRef || !rightRef || !canSubmit) return;
    await onSubmit({
      left: leftRef,
      right: rightRef,
      reason: trimmedReason,
    });
  }, [canSubmit, leftRef, onSubmit, rightRef, trimmedReason]);

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col", className)}>
      <GameScrollArea className="min-h-0 flex-1" size="large" scrollerClassName="space-y-4 px-4 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ThisOrThatResourcePicker
            entities={entities}
            label={copy.leftLabel}
            value={leftEntity}
            onChange={setLeftEntity}
            placeholder={copy.searchPlaceholder}
            exclude={rightEntity}
            gameLocale={gameLocale}
          />
          <ThisOrThatResourcePicker
            entities={entities}
            label={copy.rightLabel}
            value={rightEntity}
            onChange={setRightEntity}
            placeholder={copy.searchPlaceholder}
            exclude={leftEntity}
            gameLocale={gameLocale}
          />
        </div>

        <label className="relative block">
          {!reason && (
            <span className="pointer-events-none absolute left-3 top-2.5 max-w-[calc(100%-1.5rem)] truncate font-game-title text-sm text-muted-foreground rich-jitter">
              {placeholder}
            </span>
          )}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={4}
            className="service-textarea min-h-28 resize-y"
          />
        </label>
      </GameScrollArea>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <span className={`font-mono text-xs ${trimmedReason.length > 500 ? "text-red-400" : "text-muted-foreground"}`}>
          {trimmedReason.length}/500
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <EngagementSpinner size={14} /> : <StoryWriteIcon size={15} />}
          {submitting ? "..." : copy.submit}
        </button>
      </div>
    </form>
  );
}

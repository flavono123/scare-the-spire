"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexBlitzEntry } from "@/lib/codex-types";
import { closeOnPlainClick } from "@/lib/plain-click";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { CompendiumAssetImageActions } from "./compendium-asset-image-actions";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";
import { ModifierToken } from "./modifier-token";
import { RichDescription } from "./rich-description";

export const BLITZ_CURSED_COLOR = "#ff5555";

export function BlitzEntryInspect({
  entry,
  entities,
  gameUi,
  size = 96,
}: {
  entry: CodexBlitzEntry;
  entities?: EntityInfo[];
  gameUi?: CodexGameUiLabels;
  size?: number;
}) {
  const excludeSelf = useMemo(() => new Set([entry.name, entry.nameEn]), [entry.name, entry.nameEn]);
  return (
    <div className="flex w-full max-w-[32rem] items-center gap-3 sm:gap-5">
      <ModifierToken modifier={entry} size={size} />
      <GameHoverTip title={entry.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
        {entities ? (
          <RichDescription
            gameUi={gameUi}
            description={entry.description}
            entities={entities}
            excludeEntityTerms={excludeSelf}
            className="block text-left"
          />
        ) : (
          <DescriptionText description={entry.description} className="block text-left" />
        )}
      </GameHoverTip>
    </div>
  );
}

export function BlitzEntryDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  entry,
  entities,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  entry: CodexBlitzEntry;
  entities?: EntityInfo[];
  onClose?: () => void;
}) {
  const localizeLink = useLocalizedHref();
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.blitzShopView;
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const [commentCount, setCommentCount] = useState(0);
  const englishName = serviceLocale === "ko" ? "영어명" : "English name";

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6" data-blitz-entry-detail>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          prefetch={onClose ? false : undefined}
          href={localizeLink("/compendium/blitz-shop")}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => closeOnPlainClick(event, onClose)}
        >
          ← {backToListTitle}
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[18rem] flex-col items-center justify-center gap-2 py-4">
          <div ref={assetCopyTargetRef}>
            <BlitzEntryInspect entry={entry} entities={entities} gameUi={gameUi} />
          </div>
          <CompendiumAssetImageActions
            serviceLocale={serviceLocale}
            fileName={`${entry.id}.png`}
            targetRef={assetCopyTargetRef}
          />
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
                  style={{ color: entry.cursed ? BLITZ_CURSED_COLOR : undefined }}
                >
                  {entry.cursed ? view.cursed : view.normal}
                </span>
                {entry.rare && (
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold text-[#ffd700]">
                    {view.rare}
                  </span>
                )}
              </div>
              {(entry.cursed || entry.rare) && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {[entry.cursed && view.cursedDetail, entry.rare && view.rareDetail].filter(Boolean).join(" ")}
                </p>
              )}
              {entry.link && (
                <Link
                  href={localizeLink(buildCompendiumResourceHref(entry.link.type, entry.link.id))}
                  className="block font-game-text text-sm text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  {entry.link.name} →
                </Link>
              )}
              {entry.nameEn !== entry.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{englishName}</div>
                  <div className="font-game-text text-sm text-foreground">{entry.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <details className="group rounded-lg border border-border bg-compendium-rail px-4 py-3" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
              <span>{`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}</span>
              <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3">
              <CommentSection
                threadKey={buildCodexCommentThreadKey("blitzEntry", entry.id)}
                onCountChange={setCommentCount}
              />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

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
import type { CodexDominion } from "@/lib/codex-types";
import { closeOnPlainClick } from "@/lib/plain-click";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { CompendiumAssetImageActions } from "./compendium-asset-image-actions";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";
import { ModifierToken } from "./modifier-token";
import { RichDescription } from "./rich-description";
import { RelatedResourceLinks, referenceGroupsFromIds } from "./entity-reference-links";

export function DominionInspect({
  dominion,
  entities,
  gameUi,
  size = 96,
}: {
  dominion: CodexDominion;
  entities?: EntityInfo[];
  gameUi?: CodexGameUiLabels;
  size?: number;
}) {
  const excludeSelf = useMemo(() => new Set([dominion.name, dominion.nameEn]), [dominion.name, dominion.nameEn]);
  return (
    <div className="flex w-full max-w-[32rem] items-center gap-3 sm:gap-5">
      <ModifierToken modifier={dominion} size={size} />
      <GameHoverTip title={dominion.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
        {entities ? (
          <RichDescription
            gameUi={gameUi}
            description={dominion.description}
            entities={entities}
            excludeEntityTerms={excludeSelf}
            className="block text-left"
          />
        ) : (
          <DescriptionText description={dominion.description} className="block text-left" />
        )}
      </GameHoverTip>
    </div>
  );
}

export function DominionDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  dominion,
  entities,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  dominion: CodexDominion;
  entities?: EntityInfo[];
  onClose?: () => void;
}) {
  const localizeLink = useLocalizedHref();
  const serviceText = getCodexServiceMessages(serviceLocale);
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const [commentCount, setCommentCount] = useState(0);
  const englishName = serviceLocale === "ko" ? "영어명" : "English name";

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6" data-dominion-detail>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          prefetch={onClose ? false : undefined}
          href={localizeLink("/compendium/dominions")}
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
            <DominionInspect dominion={dominion} entities={entities} gameUi={gameUi} />
          </div>
          <CompendiumAssetImageActions
            serviceLocale={serviceLocale}
            fileName={`${dominion.id}.png`}
            targetRef={assetCopyTargetRef}
          />
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {dominion.act && (
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold text-foreground">
                    {gameUi.acts[dominion.act]}
                  </span>
                )}
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm text-foreground">
                  {serviceText.dominionsView.categories[dominion.category]}
                </span>
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{serviceText.dominionsView.boss}</div>
                <Link
                  href={localizeLink(buildCompendiumResourceHref("encounter", dominion.encounterId))}
                  className="font-game-text text-sm text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  {dominion.encounterName} →
                </Link>
              </div>
              {dominion.nameEn !== dominion.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{englishName}</div>
                  <div className="font-game-text text-sm text-foreground">{dominion.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <RelatedResourceLinks
            gameUi={gameUi}
            groups={referenceGroupsFromIds(dominion.related, entities)}
            serviceLocale={serviceLocale}
          />

          <details className="group rounded-lg border border-border bg-compendium-rail px-4 py-3" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
              <span>{`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}</span>
              <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3">
              <CommentSection
                threadKey={buildCodexCommentThreadKey("dominion", dominion.id)}
                onCountChange={setCommentCount}
              />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

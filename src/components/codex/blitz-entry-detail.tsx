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
import type { CodexBlitzEntry, CodexBlitzEntryVariant } from "@/lib/codex-types";
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
  variant = null,
  entities,
  gameUi,
  size = 96,
}: {
  entry: CodexBlitzEntry;
  /** One of the template's values, as the shop shows it. */
  variant?: CodexBlitzEntryVariant | null;
  entities?: EntityInfo[];
  gameUi?: CodexGameUiLabels;
  size?: number;
}) {
  const shown = variant ?? entry;
  const excludeSelf = useMemo(() => new Set([shown.name, shown.nameEn]), [shown.name, shown.nameEn]);
  return (
    <div className="flex w-full max-w-[32rem] items-center gap-3 sm:gap-5">
      <ModifierToken modifier={entry} size={size} />
      <GameHoverTip title={shown.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
        {entities ? (
          <RichDescription
            gameUi={gameUi}
            description={shown.description}
            entities={entities}
            excludeEntityTerms={excludeSelf}
            className="block text-left"
          />
        ) : (
          <DescriptionText description={shown.description} className="block text-left" />
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
  const [variantId, setVariantId] = useState<string | null>(null);
  const variant = entry.variants.find((item) => item.id === variantId) ?? null;
  const link = variant
    ? { ...variant.link, name: variant.name }
    : entry.link;
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
            <BlitzEntryInspect entry={entry} variant={variant} entities={entities} gameUi={gameUi} />
          </div>
          <CompendiumAssetImageActions
            serviceLocale={serviceLocale}
            fileName={`${entry.id}.png`}
            targetRef={assetCopyTargetRef}
          />
          {entry.variants.length > 0 && (
            <div className="mt-4 w-full max-w-[32rem]">
              <div className="mb-2 text-xs text-muted-foreground">{view.variants}</div>
              <div className="flex flex-wrap gap-2">
                {entry.variants.map((item) => {
                  const active = item.id === variantId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVariantId(active ? null : item.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-game-text text-sm transition-colors ${
                        active ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.04] text-foreground hover:border-white/30"
                      }`}
                    >
                      {item.iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.iconUrl} alt="" className="h-5 w-5 object-contain" />
                      )}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
                  style={{ color: entry.rare ? "#ffd700" : undefined }}
                >
                  {entry.rare ? view.rare : view.normal}
                </span>
                {entry.cursed && (
                  <span
                    className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
                    style={{ color: BLITZ_CURSED_COLOR }}
                  >
                    {view.cursed}
                  </span>
                )}
                {entry.categories.map((category) => (
                  <span key={category} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm text-foreground">
                    {view.categories[category]}
                  </span>
                ))}
              </div>
              {(entry.cursed || entry.rare) && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {[entry.cursed && view.cursedDetail, entry.rare && view.rareDetail].filter(Boolean).join(" ")}
                </p>
              )}
              {link && (
                <Link
                  href={localizeLink(buildCompendiumResourceHref(link.type, link.id))}
                  className="block font-game-text text-sm text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  {link.name} →
                </Link>
              )}
              {(variant ?? entry).nameEn !== (variant ?? entry).name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{englishName}</div>
                  <div className="font-game-text text-sm text-foreground">{(variant ?? entry).nameEn}</div>
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

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  badgeBaseImageUrl,
  getRunBadgeVariants,
  type RunBadgeCatalogEntry,
} from "@/lib/run-badges";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";

export function BadgeDetail({
  serviceLocale,
  gameLocale,
  backToListTitle,
  badge,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  backToListTitle: string;
  badge: RunBadgeCatalogEntry;
  onClose?: () => void;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const variants = getRunBadgeVariants(badge);
  const [commentCount, setCommentCount] = useState(0);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6" data-badge-detail>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHrefWithGameLocale("/compendium/badges", serviceLocale, gameLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => {
            if (onClose) {
              event.preventDefault();
              onClose();
            }
          }}
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
        <section className="flex min-h-[22rem] flex-col items-center justify-center gap-5 py-4">
          {variants.map((variant) => (
            <div
              key={variant.rarity}
              className="flex w-full max-w-[32rem] items-center gap-3 sm:gap-5"
            >
              <div className="relative h-20 w-20 shrink-0 drop-shadow-[0_3px_7px_rgba(0,0,0,0.85)] sm:h-24 sm:w-24">
                <Image
                  src={badgeBaseImageUrl(variant.rarity)}
                  alt=""
                  fill
                  className="object-contain"
                  aria-hidden
                />
                {badge.imageUrl && (
                  <Image
                    src={badge.imageUrl}
                    alt={variant.title}
                    fill
                    className="object-contain"
                  />
                )}
              </div>
              <GameHoverTip
                title={variant.title}
                className="min-w-0 w-full"
                style={{ minWidth: 0 }}
              >
                <DescriptionText description={variant.description} className="block text-left" />
              </GameHoverTip>
            </div>
          ))}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-card/80 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold text-gray-300">
                {badge.multiplayerOnly
                  ? serviceText.badgesView.multiplayerOnly
                  : serviceText.badgesView.singleplayer}
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold text-gray-300">
                {variants.length > 1
                  ? serviceText.badgesView.tieredRanks
                  : serviceText.badgesView.singleRank}
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold text-gray-300">
                {badge.requiresWin
                  ? serviceText.badgesView.winRequired
                  : serviceText.badgesView.winNotRequired}
              </span>
            </div>
          </section>

          <details
            className="group rounded-lg border border-border bg-card/80 px-4 py-3"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
              <span>
                {serviceText.common.comments}{commentCount > 0 ? ` (${commentCount})` : ""}
              </span>
              <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3">
              <CommentSection
                threadKey={buildCodexCommentThreadKey("badge", badge.id)}
                onCountChange={setCommentCount}
              />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

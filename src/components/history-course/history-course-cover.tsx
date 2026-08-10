"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { CardTile } from "@/components/codex/card-tile";
import { RunBadgeStrip } from "@/components/history-course/run-badge-strip";
import {
  coverCatalogCard,
  useCoverCardCatalog,
} from "@/hooks/use-cover-card-catalog";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  coverCharacterArtStyle,
  coverCharacterSelectBackgroundSrc,
} from "@/lib/run-cover-character-frame";
import {
  characterSpireClass,
  coverCardArtSrc,
  coverCharacterPortraitSrc,
  coverCharacterSelectSrc,
  coverElementImageSrc,
  displayNameForCoverElement,
} from "@/lib/run-cover-display";
import type { CoverElement, CoverSpec } from "@/lib/run-cover-types";
import type { ReplayBadge } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

export interface HistoryCourseCoverMeta {
  win: boolean;
  totalFloors: number;
  ascension: number;
  build: string;
  seed: string;
  badges?: ReplayBadge[];
}

interface HistoryCourseCoverProps {
  cover: CoverSpec;
  character: string;
  meta?: HistoryCourseCoverMeta;
  className?: string;
  size?: "index" | "compact";
}

export function HistoryCourseCover({
  cover,
  character,
  meta,
  className,
  size = "index",
}: HistoryCourseCoverProps) {
  const serviceLocale = useServiceLocale();
  const cardCatalog = useCoverCardCatalog();
  const phraseClass = characterSpireClass(character);
  const cardBg =
    cover.background.kind === "card-beta" ? cover.background : null;
  const cardArt = cardBg ? coverCardArtSrc(cardBg.cardId) : null;
  const selectBg = !cardBg
    ? coverCharacterSelectBackgroundSrc(character)
    : null;
  const charArtStyle = !cardBg ? coverCharacterArtStyle(character) : undefined;
  const [fgSrc, setFgSrc] = useState(
    cardArt ? cardArt.beta : coverCharacterSelectSrc(character),
  );
  const [fgFailed, setFgFailed] = useState(false);
  const compact = size === "compact";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-zinc-950",
        compact ? "aspect-video rounded-md" : "aspect-[16/9] rounded-xl",
        className,
      )}
    >
      {selectBg && (
        <Image
          src={selectBg}
          alt=""
          fill
          sizes={compact ? "160px" : "720px"}
          className="object-cover object-center"
        />
      )}

      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={
            fgFailed
              ? coverCharacterPortraitSrc(character)
              : fgSrc
          }
          alt=""
          fill
          sizes={compact ? "160px" : "720px"}
          className={cn(
            "object-cover",
            cardBg ? "object-center scale-110" : "will-change-transform",
          )}
          style={charArtStyle as CSSProperties | undefined}
          onError={() => {
            if (cardArt && fgSrc === cardArt.beta) {
              setFgSrc(cardArt.src);
              return;
            }
            if (!cardBg && !fgFailed) {
              setFgFailed(true);
              setFgSrc(coverCharacterPortraitSrc(character));
            }
          }}
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35" />

      {/* Phrase — top left */}
      <p
        className={cn(
          "absolute left-2 top-2 z-10 max-w-[55%] font-game-title font-bold leading-tight cover-phrase-outline",
          phraseClass,
          compact ? "text-[11px]" : "text-base sm:text-xl md:text-2xl",
        )}
      >
        {cover.phrase}
      </p>

      {/* Meta — top right */}
      {meta && (
        <div
          className={cn(
            "absolute right-2 top-2 z-10 flex items-center",
            compact ? "gap-1" : "gap-1.5",
          )}
        >
          <OutcomeChip win={meta.win} compact={compact} ko={serviceLocale === "ko"} />
          <FloorChip floor={meta.totalFloors} compact={compact} />
          {meta.ascension > 0 && (
            <AscensionChip ascension={meta.ascension} compact={compact} />
          )}
          <span
            className={cn(
              "font-bold spire-gold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
              compact ? "text-[9px]" : "text-[11px] sm:text-xs",
            )}
          >
            {meta.build}
          </span>
        </div>
      )}

      {/* Elements — bottom left, no container chrome */}
      {cover.elements.length > 0 && (
        <div
          className={cn(
            "absolute bottom-2 left-2 z-10 flex items-end",
            compact ? "gap-0.5" : "gap-1",
          )}
        >
          {cover.elements.slice(0, 3).map((element) => (
            <CoverElementVisual
              key={`${element.kind}:${element.id}`}
              element={element}
              compact={compact}
              cardCatalog={cardCatalog}
            />
          ))}
        </div>
      )}

      {/* Badges + seed — bottom right */}
      {meta && (
        <div
          className={cn(
            "absolute bottom-2 right-2 z-10 flex max-w-[55%] flex-col items-end",
            compact ? "gap-0.5" : "gap-1",
          )}
        >
          {meta.badges && meta.badges.length > 0 && (
            <RunBadgeStrip
              badges={meta.badges}
              serviceLocale={serviceLocale}
              size="sm"
              max={compact ? 3 : 5}
              tipPlacement="below-left"
              className="justify-end"
            />
          )}
          <code
            className={cn(
              "truncate font-mono text-zinc-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]",
              compact ? "max-w-[7rem] text-[8px]" : "max-w-[14rem] text-[10px] sm:text-[11px]",
            )}
          >
            {meta.seed}
          </code>
        </div>
      )}
    </div>
  );
}

function OutcomeChip({
  win,
  compact,
  ko,
}: {
  win: boolean;
  compact: boolean;
  ko: boolean;
}) {
  return (
    <span
      className={cn(
        "font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
        win ? "text-emerald-300" : "text-red-300",
        compact ? "text-[9px]" : "text-[11px] sm:text-xs",
      )}
    >
      {ko ? (win ? "클리어" : "패배") : win ? "Win" : "Loss"}
    </span>
  );
}

function FloorChip({ floor, compact }: { floor: number; compact: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <Image
        src="/images/sts2/ui/topbar/top_bar_floor.png"
        alt=""
        width={compact ? 16 : 22}
        height={compact ? 15 : 20}
        className={cn(
          "object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
          compact ? "h-3.5 w-4" : "h-5 w-[22px]",
        )}
        unoptimized
      />
      <span
        className={cn(
          "topbar-num font-bold tabular-nums text-zinc-50",
          compact ? "text-[10px]" : "text-xs sm:text-sm",
        )}
      >
        {floor}
      </span>
    </span>
  );
}

function AscensionChip({
  ascension,
  compact,
}: {
  ascension: number;
  compact: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-end justify-center",
        compact ? "h-5 w-5" : "h-6 w-6",
      )}
    >
      <Image
        src="/images/sts2/ui/topbar/top_bar_ascension.png"
        alt=""
        fill
        sizes={compact ? "20px" : "24px"}
        className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        unoptimized
      />
      <span
        className={cn(
          "topbar-num relative z-10 font-bold tabular-nums text-zinc-50",
          compact ? "mb-0 text-[9px]" : "mb-0 text-[11px]",
        )}
      >
        {ascension}
      </span>
    </span>
  );
}

function CoverElementVisual({
  element,
  compact,
  cardCatalog,
}: {
  element: CoverElement;
  compact: boolean;
  cardCatalog: ReturnType<typeof useCoverCardCatalog>;
}) {
  const label = displayNameForCoverElement(element);
  const cardWidth = compact ? 36 : 56;

  if (element.kind === "card") {
    const card = coverCatalogCard(cardCatalog, element.id);
    if (card) {
      return (
        <span className="relative" title={label}>
          <CardTile
            card={card}
            showUpgrade={false}
            showBeta={false}
            width={cardWidth}
            interactive={false}
            keywordOverride={[]}
            descriptionContent={<span />}
          />
          {element.copies && element.copies > 1 && (
            <CopiesBadge copies={element.copies} />
          )}
        </span>
      );
    }
  }

  return (
    <span className="relative" title={label}>
      <Image
        src={coverElementImageSrc(element)}
        alt=""
        width={cardWidth}
        height={cardWidth}
        className={cn(
          "object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.75)]",
          compact ? "h-9 w-9" : "h-14 w-14",
        )}
      />
      {element.copies && element.copies > 1 && (
        <CopiesBadge copies={element.copies} />
      )}
    </span>
  );
}

function CopiesBadge({ copies }: { copies: number }) {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 rounded bg-black/80 px-0.5 text-[9px] font-bold leading-none text-amber-200">
      ×{copies}
    </span>
  );
}

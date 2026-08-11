"use client";

import Image from "next/image";
import { Check, Copy } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { CardTile } from "@/components/codex/card-tile";
import { TinyCardIcon } from "@/components/history-course/card-action-icon";
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
import type { ServiceLocale } from "@/lib/i18n";
import type { CoverElement, CoverSpec } from "@/lib/run-cover-types";
import { CARD_ASPECT_H, CARD_ASPECT_W } from "@/lib/sts2-card-style";
import type { ReplayBadge } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

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
  /** Rendered above win/floor/ascension/build in the top-right stack. */
  topRightActions?: ReactNode;
}

export function HistoryCourseCover({
  cover,
  character,
  meta,
  className,
  size = "index",
  topRightActions,
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
  // Official art first; beta only if official is missing (onError).
  const desiredFgSrc = cardArt
    ? cardArt.src
    : coverCharacterSelectSrc(character);
  const [fgSrc, setFgSrc] = useState(desiredFgSrc);
  const [fgFailed, setFgFailed] = useState(false);
  const compact = size === "compact";
  const elements = cover.elements.slice(0, 3);
  const cardSlotCount = elements.filter((el) => el.kind === "card").length;
  const nonCardCount = elements.length - cardSlotCount;
  const bottomLeftRef = useRef<HTMLDivElement>(null);
  const targetCardWidth = coverCardWidth(compact, cardSlotCount);
  const gapPx = compact ? 2 : 8;
  const iconSize = compact ? 36 : 56;
  const { tinyCards, cardWidth } = useCoverCardLayout(bottomLeftRef, {
    cardSlotCount,
    targetCardWidth,
    // Icons + every inter-item gap; remainder is split across full cards.
    reservedWidth:
      nonCardCount * iconSize + Math.max(0, elements.length - 1) * gapPx,
  });

  // Cover editor switches A/B (and B card id) without remounting — resync art.
  useEffect(() => {
    setFgSrc(desiredFgSrc);
    setFgFailed(false);
  }, [desiredFgSrc]);

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
            if (cardArt && fgSrc === cardArt.src && cardArt.beta !== cardArt.src) {
              setFgSrc(cardArt.beta);
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

      {/*
        Four zones. With action chips, right column sizes to content (max-content)
        so half-width 13" cards never clip the left of end-aligned chips/meta.
        Phrase cell clips its own overflow so long titles don't paint over meta.
      */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 grid",
          topRightActions
            ? "grid-cols-[minmax(0,1fr)_max-content]"
            : "grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]",
          "grid-rows-[auto_minmax(0,1fr)]",
          compact ? "gap-x-1.5 gap-y-1 p-2.5" : "gap-x-2 gap-y-1.5 p-3 sm:gap-x-3 sm:gap-y-2 sm:p-4 md:p-5",
        )}
      >
        <div className="min-w-0 self-start overflow-hidden">
          <p
            className={cn(
              "font-game-title font-bold leading-tight cover-phrase-outline",
              // Narrow cards: keep phrase to one line so bottom-left art fits.
              compact
                ? "line-clamp-2 text-[15px]"
                : "line-clamp-1 text-lg sm:line-clamp-2 sm:text-xl md:text-3xl lg:text-4xl",
              phraseClass,
            )}
          >
            {cover.phrase}
          </p>
        </div>

        <div
          className={cn(
            "flex flex-col items-end gap-0.5 self-start justify-self-end",
            // Cap so very narrow cards still wrap instead of eating the phrase.
            topRightActions ? "w-max max-w-[14.5rem]" : "w-full min-w-0",
          )}
        >
          {topRightActions && (
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-end gap-1">
              {topRightActions}
            </div>
          )}
          {meta && (
            <div
              className={cn(
                "flex max-w-full flex-wrap items-center justify-end",
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
        </div>

        <div
          ref={bottomLeftRef}
          className={cn(
            "flex min-h-0 min-w-0 items-end self-stretch overflow-hidden",
            compact ? "gap-0.5" : "gap-1.5 sm:gap-2",
          )}
        >
          {elements.map((element) => (
            <CoverElementVisual
              key={`${element.kind}:${element.id}`}
              element={element}
              compact={compact}
              cardCatalog={cardCatalog}
              cardWidth={cardWidth}
              tinyCards={tinyCards}
            />
          ))}
        </div>

        <CoverBottomRightMeta
          meta={meta}
          compact={compact}
          serviceLocale={serviceLocale}
        />
      </div>
    </div>
  );
}

const MIN_FULL_CARD_WIDTH = 72;

/** Stack badges above seed by default; collapse to one row only when zone is short. */
function CoverBottomRightMeta({
  meta,
  compact,
  serviceLocale,
}: {
  meta?: HistoryCourseCoverMeta;
  compact: boolean;
  serviceLocale: ServiceLocale;
}) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [tight, setTight] = useState(false);
  const hasBadges = Boolean(meta?.badges && meta.badges.length > 0);

  useEffect(() => {
    const el = zoneRef.current;
    if (!el || !meta) return;

    const update = () => {
      // Badges (~28) + gap (~4) + seed chip (~22) need ~54px stacked.
      const needed = hasBadges ? (compact ? 50 : 56) : 0;
      setTight(hasBadges && el.clientHeight > 0 && el.clientHeight < needed);
    };

    update();
    const raf = window.requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [compact, hasBadges, meta]);

  if (!meta) return <div />;

  return (
    <div
      ref={zoneRef}
      className="flex min-h-0 min-w-0 items-end justify-end self-stretch overflow-hidden"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-full items-end justify-end",
          tight ? "flex-nowrap gap-1 overflow-hidden" : "flex-col gap-1",
          compact && !tight && "gap-0.5",
        )}
      >
        {hasBadges && (
          <RunBadgeStrip
            badges={meta.badges!}
            serviceLocale={serviceLocale}
            size="sm"
            max={compact ? 3 : 5}
            tipPlacement="below-left"
            className={cn(
              "justify-end",
              tight && "min-w-0 flex-nowrap overflow-hidden",
            )}
          />
        )}
        <SeedCopyChip seed={meta.seed} compact={compact} />
      </div>
    </div>
  );
}

function useCoverCardLayout(
  zoneRef: RefObject<HTMLDivElement | null>,
  {
    cardSlotCount,
    targetCardWidth,
    reservedWidth,
  }: {
    cardSlotCount: number;
    targetCardWidth: number;
    /** Non-card icons + all inter-item gaps already spoken for. */
    reservedWidth: number;
  },
): { tinyCards: boolean; cardWidth: number } {
  const [layout, setLayout] = useState({
    tinyCards: false,
    cardWidth: targetCardWidth,
  });

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || cardSlotCount <= 0) {
      setLayout({ tinyCards: false, cardWidth: targetCardWidth });
      return;
    }

    const update = () => {
      const availW = zone.clientWidth;
      const availH = zone.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      const availForCards = Math.max(0, availW - reservedWidth);
      const fittedW = Math.floor(availForCards / cardSlotCount);
      const width = Math.max(1, Math.min(targetCardWidth, fittedW));
      const cardH = (width * CARD_ASPECT_H) / CARD_ASPECT_W;
      const tinyCards = width < MIN_FULL_CARD_WIDTH || cardH > availH + 1;
      setLayout({
        tinyCards,
        cardWidth: tinyCards ? targetCardWidth : width,
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(zone);
    return () => ro.disconnect();
  }, [cardSlotCount, reservedWidth, targetCardWidth, zoneRef]);

  return layout;
}

function SeedCopyChip({
  seed,
  compact,
}: {
  seed: string;
  compact: boolean;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.runCard;
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(seed);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        // Older browsers without clipboard API.
      }
    },
    [seed],
  );

  return (
    <button
      type="button"
      onClick={onCopy}
      title={copied ? copy.seedCopied : copy.copySeed}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 font-mono font-bold backdrop-blur transition ring-1 ring-inset",
        copied
          ? "text-emerald-200 ring-emerald-400/30"
          : "text-zinc-100 ring-white/15 hover:bg-white/10 hover:ring-amber-300/35 hover:text-amber-50",
        compact ? "text-[8px]" : "text-[10px] sm:text-[11px]",
      )}
    >
      {copied ? (
        <>
          <Check className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} aria-hidden />
          <span>{copy.seedCopied}</span>
        </>
      ) : (
        <>
          <Copy className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} aria-hidden />
          <span className="truncate">{seed}</span>
        </>
      )}
    </button>
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

function coverCardWidth(compact: boolean, cardSlotCount: number): number {
  if (compact) return cardSlotCount >= 2 ? 56 : 72;
  if (cardSlotCount >= 3) return 112;
  if (cardSlotCount === 2) return 132;
  return 150;
}

function CoverElementVisual({
  element,
  compact,
  cardCatalog,
  cardWidth,
  tinyCards,
}: {
  element: CoverElement;
  compact: boolean;
  cardCatalog: ReturnType<typeof useCoverCardCatalog>;
  cardWidth: number;
  tinyCards: boolean;
}) {
  const label = displayNameForCoverElement(element);
  const iconSize = compact ? 36 : 56;

  if (element.kind === "card") {
    const card = coverCatalogCard(cardCatalog, element.id);
    if (card) {
      if (tinyCards) {
        return (
          <span className="relative shrink-0" title={label}>
            <TinyCardIcon
              card={{
                color: card.color,
                visualColor: card.visualColor,
                rarity: card.rarity,
                type: card.type,
              }}
              width={compact ? 28 : 44}
            />
            {element.copies && element.copies > 1 && (
              <CopiesBadge copies={element.copies} />
            )}
          </span>
        );
      }
      return (
        <span className="relative shrink-0" title={label}>
          <CardTile
            card={card}
            showUpgrade={false}
            showBeta={false}
            width={cardWidth}
            interactive={false}
            keywordOverride={[]}
          />
          {element.copies && element.copies > 1 && (
            <CopiesBadge copies={element.copies} />
          )}
        </span>
      );
    }
  }

  return (
    <span className="relative shrink-0" title={label}>
      <Image
        src={coverElementImageSrc(element)}
        alt=""
        width={iconSize}
        height={iconSize}
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

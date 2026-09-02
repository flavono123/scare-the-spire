"use client";

import { Shuffle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { DonatedRunSummary } from "@/lib/run-donation";
import { cn } from "@/lib/utils";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

interface Props {
  runs: DonatedRunSummary[];
  userId: string | null;
}

/** Baked from `char_select_bg_random_character.tscn` GradientTexture2D. */
const RANDOM_SELECT_BG =
  "/images/sts2/character-select/character_select_random_bg.webp";

/**
 * Same thumbnail zones as HistoryCourseCover, then YouTube-style caption
 * placeholders for version / playtime / seed.
 */
export function RandomPickCard({ runs, userId }: Props) {
  const copy = serviceMessages[useServiceLocale()].historyCourse.runCard;
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const pick = useCallback(() => {
    if (runs.length === 0) return;
    setPending(true);
    const others = userId
      ? runs.filter((r) => r.donor_user_id !== userId)
      : runs;
    const pool = others.length > 0 ? others : runs;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/history-course/${choice.id}`);
  }, [router, runs, userId]);

  const disabled = runs.length === 0 || pending;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (disabled) return;
      const target = event.target as HTMLElement;
      if (target.closest("a, button, [role='button']")) return;
      pick();
    },
    [disabled, pick],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      if (event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      pick();
    },
    [disabled, pick],
  );

  return (
    <article
      role="link"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled || undefined}
      title={
        runs.length === 0
          ? copy.randomEmptyTitle
          : copy.randomPickTitle
      }
      className={cn(
        "toybox-video-lockup group hover:z-10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        pending && "cursor-wait opacity-60",
      )}
    >
      <span className="toybox-video-lockup-plate" aria-hidden />
      <div className="relative z-[1]">
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950",
            "ring-2 ring-amber-400/60",
            !disabled && "random-pick-glow",
          )}
        >
          <Image
            src={RANDOM_SELECT_BG}
            alt=""
            fill
            sizes="720px"
            className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            priority={false}
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10 grid",
              "grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]",
              "grid-rows-[auto_minmax(0,1fr)]",
              "gap-x-2 gap-y-1.5 p-3 sm:gap-x-3 sm:gap-y-2 sm:p-4 md:p-5",
            )}
          >
            <div className="min-w-0 self-start overflow-hidden">
              <p
                className={cn(
                  "font-game-title text-lg font-bold leading-tight spire-gold sm:text-xl md:text-3xl lg:text-4xl",
                  "cover-phrase-outline",
                )}
              >
                {copy.random}
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 self-start">
              <span className="text-[11px] font-bold text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-xs">
                ?
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Image
                  src="/images/sts2/ui/topbar/top_bar_floor.png"
                  alt=""
                  width={22}
                  height={20}
                  className="h-5 w-[22px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  unoptimized
                />
                <span className="topbar-num text-xs font-bold tabular-nums sm:text-sm">
                  ?
                </span>
              </span>
              <span className="relative inline-flex h-6 w-6 items-end justify-center">
                <Image
                  src="/images/sts2/ui/topbar/top_bar_ascension.png"
                  alt=""
                  fill
                  sizes="24px"
                  className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  unoptimized
                />
                <span className="topbar-num relative z-10 mb-0 text-[11px] font-bold tabular-nums">
                  ?
                </span>
              </span>
            </div>

            <div className="min-h-0 min-w-0 self-stretch" />
            <div className="min-h-0 min-w-0 self-stretch" />
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 z-20 sm:bottom-4 sm:left-4">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5",
                "text-[11px] font-bold text-zinc-950 shadow-[0_2px_10px_rgba(0,0,0,0.45)]",
                "ring-1 ring-inset ring-amber-200/80",
                "transition-[transform,background-color,box-shadow] duration-200",
                "group-hover:bg-amber-300 group-hover:shadow-[0_4px_16px_rgba(239,200,81,0.45)]",
                "group-hover:-translate-y-0.5",
                "group-active:translate-y-0 group-active:bg-amber-400",
              )}
            >
              <Shuffle className="h-3.5 w-3.5" aria-hidden />
              {copy.randomPickCta}
            </span>
          </div>
        </div>
        <div className="mt-3 min-w-0">
          <h2 className="truncate font-service text-[15px] font-semibold leading-snug text-foreground">
            ?
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            <span className="tabular-nums">?:??:??</span>
            <span aria-hidden className="mx-1.5 text-muted-foreground/50">
              ·
            </span>
            <span className="font-mono">?</span>
          </p>
        </div>
      </div>
    </article>
  );
}

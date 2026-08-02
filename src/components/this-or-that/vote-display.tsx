"use client";

import { GameChoiceFrame } from "@/components/codex/event-choice-frame";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";
import Image from "@/components/ui/static-image";
import {
  thisOrThatVotePercentage,
  type ThisOrThatVoteChoice,
  type ThisOrThatVoteSummary,
} from "@/lib/this-or-that-votes";

const KNOWLEDGE_DEMON_TOKEN = "/images/sts2/bosses/knowledge_demon_boss.webp";

export function ThisOrThatVoteChoiceFrame({
  side,
  label,
  choice,
}: {
  side: ThisOrThatVoteChoice;
  label: string;
  choice?: ThisOrThatVoteChoice;
}) {
  const selected = choice === side;
  const icon = selected ? "thumb_up.png" : "thumb_down.png";

  return (
    <GameChoiceFrame active={selected}>
      <span className={`flex items-center justify-center gap-2 font-game-text text-base font-bold ${
        choice ? side === "left" ? "spire-aqua" : "spire-pink" : "spire-gold"
      }`}>
        {label}
        {choice && (
          <Image
            src={`/images/sts2/ui/emote/${icon}`}
            alt=""
            width={26}
            height={26}
            aria-hidden
            className="h-6 w-6 object-contain drop-shadow"
          />
        )}
      </span>
    </GameChoiceFrame>
  );
}

export function ThisOrThatVoteStatus({
  summary,
  choice,
  prompt,
  done,
  voteCountTemplate,
  voteBreakdownTemplate,
  retryLabel,
  loading,
  pending,
  unavailable,
  onRetry,
}: {
  summary: ThisOrThatVoteSummary;
  choice?: ThisOrThatVoteChoice;
  prompt: string;
  done: string;
  voteCountTemplate: string;
  voteBreakdownTemplate: string;
  retryLabel: string;
  loading: boolean;
  pending: boolean;
  unavailable: boolean;
  onRetry: () => void;
}) {
  const leftPercent = thisOrThatVotePercentage(summary, "left");
  const rightPercent = summary.totalCount === 0 ? 0 : 100 - leftPercent;
  const formatBreakdown = (percent: number, count: number) => voteBreakdownTemplate
    .replace("{percent}", String(percent))
    .replace("{count}", String(count));

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex min-h-5 items-center justify-between gap-3 font-game-text text-xs font-bold sm:text-sm">
        {choice ? (
          <>
            <span className="spire-aqua">
              {formatBreakdown(leftPercent, summary.leftCount)}
            </span>
            <span className="spire-pink text-right">
              {formatBreakdown(rightPercent, summary.rightCount)}
            </span>
          </>
        ) : (
          <span className={`flex w-full items-center tabular-nums text-muted-foreground ${unavailable ? "justify-center" : "justify-end"}`}>
            {loading ? (
              <EngagementSpinner size={15} />
            ) : unavailable ? (
              <EngagementUnavailableIcon size={15} />
            ) : (
              voteCountTemplate.replace("{count}", String(summary.totalCount))
            )}
          </span>
        )}
      </div>

      <div
        className={`flex h-2 overflow-hidden rounded-full bg-zinc-800 ${choice ? "" : "invisible"}`}
        role={choice ? "img" : undefined}
        aria-label={choice ? `${leftPercent}% / ${rightPercent}%` : undefined}
        aria-hidden={choice ? undefined : true}
      >
        <span
          className="h-full bg-[#22d3ee] transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${leftPercent}%` }}
        />
        <span
          className="h-full flex-1 bg-[#f472b6] transition-[width] duration-500 motion-reduce:transition-none"
        />
      </div>

      <div className="flex min-h-11 items-center gap-2 font-game-text text-sm font-bold text-zinc-200">
        <Image
          src={KNOWLEDGE_DEMON_TOKEN}
          alt=""
          width={34}
          height={34}
          aria-hidden
          className="h-8 w-8 shrink-0 object-contain drop-shadow"
        />
        <span className="min-w-0">{choice ? done : prompt}</span>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden={!pending}>
          {pending && <EngagementSpinner size={15} />}
        </span>
        <button
          type="button"
          onClick={onRetry}
          disabled={!choice || pending || unavailable}
          aria-hidden={!choice}
          tabIndex={choice ? undefined : -1}
          className={`ml-auto min-h-11 shrink-0 px-2 text-xs font-semibold text-muted-foreground underline decoration-white/20 underline-offset-4 transition-colors hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-50 ${choice ? "" : "invisible"}`}
        >
          {retryLabel}
        </button>
      </div>
    </div>
  );
}

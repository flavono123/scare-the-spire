"use client";

import { useCallback, useMemo, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  ThisOrThatResourcePanel,
} from "@/components/this-or-that/resource-panel";
import {
  ThisOrThatVoteChoiceFrame,
} from "@/components/this-or-that/vote-display";
import { resourceKey } from "@/lib/decisions-decisions";
import {
  buildOpeningRound,
  entityForRef,
  openingAutoAdvances,
  openingPlayablePairs,
  pairNextRound,
  samplePool,
  type FavoriteTournamentMatchRecord,
  type FavoriteTournamentResourceRef,
} from "@/lib/favorite-tournament";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

type PlayPhase = {
  startingSize: number;
  remainingPairs: Array<{
    left: FavoriteTournamentResourceRef;
    right: FavoriteTournamentResourceRef;
  }>;
  nextRound: FavoriteTournamentResourceRef[];
  matches: FavoriteTournamentMatchRecord[];
  totalMatches: number;
};

export function FavoriteTournamentPlay({
  pool,
  startingSize,
  entityMap,
  serviceLocale,
  gameLocale,
  votePrompt,
  onComplete,
}: {
  pool: FavoriteTournamentResourceRef[];
  startingSize: number;
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  votePrompt: string;
  onComplete: (result: {
    champion: FavoriteTournamentResourceRef;
    matches: FavoriteTournamentMatchRecord[];
  }) => void;
}) {
  const tot = serviceMessages[serviceLocale].thisOrThat;
  const copy = serviceMessages[serviceLocale].favoriteTournament;

  const [phase, setPhase] = useState<PlayPhase>(() => {
    const contestants = samplePool(pool, startingSize);
    const opening = buildOpeningRound(contestants);
    const playable = openingPlayablePairs(opening);
    const auto = openingAutoAdvances(opening);
    return {
      startingSize,
      remainingPairs: playable,
      nextRound: auto,
      matches: [],
      totalMatches: startingSize - 1,
    };
  });
  const [choice, setChoice] = useState<"left" | "right" | undefined>(undefined);

  const current = phase.remainingPairs[0] ?? null;
  const leftEntity = current ? entityForRef(current.left, entityMap) : undefined;
  const rightEntity = current ? entityForRef(current.right, entityMap) : undefined;

  const pick = useCallback((side: "left" | "right") => {
    if (!current || choice) return;
    setChoice(side);
    const winner = side === "left" ? current.left : current.right;
    const match: FavoriteTournamentMatchRecord = {
      left: current.left,
      right: current.right,
      winner: side,
    };
    window.setTimeout(() => {
      setPhase((currentPhase) => {
        const rest = currentPhase.remainingPairs.slice(1);
        const nextRound = [...currentPhase.nextRound, winner];
        const matches = [...currentPhase.matches, match];
        if (rest.length > 0) {
          return { ...currentPhase, remainingPairs: rest, nextRound, matches };
        }
        if (nextRound.length === 1) {
          onComplete({ champion: nextRound[0]!, matches });
          return { ...currentPhase, remainingPairs: [], nextRound, matches };
        }
        return {
          ...currentPhase,
          remainingPairs: pairNextRound(nextRound),
          nextRound: [],
          matches,
        };
      });
      setChoice(undefined);
    }, 180);
  }, [choice, current, onComplete]);

  const remainingThisRound = (current ? 1 : 0) + Math.max(0, phase.remainingPairs.length - 1);
  const roundSize = remainingThisRound * 2 + phase.nextRound.length;

  const missing = useMemo(() => {
    if (!current) return null;
    if (!leftEntity || !rightEntity) return resourceKey(current.left);
    return null;
  }, [current, leftEntity, rightEntity]);

  if (!current || !leftEntity || !rightEntity) {
    if (missing) {
      return <p className="text-sm text-muted-foreground">{copy.resourcesMissing}</p>;
    }
    return null;
  }

  return (
    <div className="space-y-4" data-favorite-tournament-play>
      <div className="flex flex-wrap items-center justify-between gap-2 font-game-text text-sm text-zinc-300">
        <span>{copy.playingRound.replace("{size}", String(roundSize || startingSize))}</span>
        <span className="tabular-nums text-muted-foreground">
          {copy.matchProgress
            .replace("{current}", String(phase.matches.length + 1))
            .replace("{total}", String(phase.totalMatches))}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
        <div className="min-w-0">
          <div className={cn("transition-[filter,opacity]", choice === "right" && "opacity-50 grayscale")}>
            <ThisOrThatResourcePanel
              entity={leftEntity}
              sideLabel={tot.leftLabel}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              size="large"
              assetOnly
            />
          </div>
          <div className="relative mt-2 rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-cyan-300/80">
            <button
              type="button"
              onClick={() => pick("left")}
              disabled={Boolean(choice)}
              aria-label={tot.choose.replace("{name}", leftEntity.nameKo).replace("{side}", tot.leftLabel)}
              className="absolute inset-0 z-10 rounded-md disabled:cursor-not-allowed"
            />
            <div className="pointer-events-none">
              <ThisOrThatVoteChoiceFrame side="left" label={tot.leftLabel} choice={choice} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center font-game-title text-2xl font-black text-primary/80 md:w-12">
          VS
        </div>
        <div className="min-w-0">
          <div className={cn("transition-[filter,opacity]", choice === "left" && "opacity-50 grayscale")}>
            <ThisOrThatResourcePanel
              entity={rightEntity}
              sideLabel={tot.rightLabel}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              size="large"
              assetOnly
            />
          </div>
          <div className="relative mt-2 rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-pink-300/80">
            <button
              type="button"
              onClick={() => pick("right")}
              disabled={Boolean(choice)}
              aria-label={tot.choose.replace("{name}", rightEntity.nameKo).replace("{side}", tot.rightLabel)}
              className="absolute inset-0 z-10 rounded-md disabled:cursor-not-allowed"
            />
            <div className="pointer-events-none">
              <ThisOrThatVoteChoiceFrame side="right" label={tot.rightLabel} choice={choice} />
            </div>
          </div>
        </div>
      </div>
      <p className="text-center font-game-text text-sm text-zinc-400">{votePrompt}</p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { GameScrollArea } from "@/components/game-scroll-area";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";
import { sortPoolRefs } from "@/lib/decisions-decisions";
import {
  entityForRef,
  previewMatchupPairs,
  type FavoriteTournamentResourceRef,
} from "@/lib/favorite-tournament";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const PREVIEW_INTERVAL_MS = 2400;
const PREVIEW_FADE_MS = 220;

export function FavoriteTournamentAssetPreview({
  pool,
  playCount,
  entityMap,
  serviceLocale,
  gameLocale,
}: {
  pool: FavoriteTournamentResourceRef[];
  playCount: number;
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const tot = serviceMessages[serviceLocale].thisOrThat;
  const roster = useMemo(() => sortPoolRefs(pool, entityMap), [entityMap, pool]);
  const presentKey = useMemo(
    () => pool
      .filter((ref) => Boolean(entityForRef(ref, entityMap)))
      .map((ref) => `${ref.type}:${ref.id}`)
      .sort()
      .join("\n"),
    [entityMap, pool],
  );
  const pairs = useMemo(() => {
    const present = new Set(presentKey.split("\n").filter(Boolean));
    return previewMatchupPairs(pool, (ref) => present.has(`${ref.type}:${ref.id}`));
  }, [pool, presentKey]);
  const [pairIndex, setPairIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (pairs.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let fadeTimer = 0;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setFading(true);
      fadeTimer = window.setTimeout(() => {
        setPairIndex((current) => (current + 1) % pairs.length);
        setFading(false);
      }, PREVIEW_FADE_MS);
    }, PREVIEW_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(fadeTimer);
    };
  }, [pairs.length]);

  const current = pairs.length === 0 ? null : pairs[pairIndex % pairs.length] ?? null;
  const leftEntity = current ? entityForRef(current.left, entityMap) : undefined;
  const rightEntity = current ? entityForRef(current.right, entityMap) : undefined;
  const matchupLabel = leftEntity && rightEntity
    ? `${leftEntity.nameKo} VS ${rightEntity.nameKo}`
    : copy.assetPreview;

  return (
    <div className="space-y-4" data-favorite-tournament-preview>
      {leftEntity && rightEntity ? (
        <div
          data-favorite-tournament-matchup
          aria-label={matchupLabel}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 transition-opacity duration-200 motion-reduce:transition-none",
            fading && "opacity-0",
          )}
        >
          <ThisOrThatResourcePanel
            entity={leftEntity}
            sideLabel={tot.leftLabel}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            assetOnly
          />
          <div className="flex w-8 items-center justify-center font-game-title text-lg font-black text-primary/80 md:w-12 md:text-2xl">
            VS
          </div>
          <ThisOrThatResourcePanel
            entity={rightEntity}
            sideLabel={tot.rightLabel}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            assetOnly
          />
        </div>
      ) : null}

      <div className="flex min-h-5 items-center justify-end font-game-text text-xs font-bold tabular-nums text-muted-foreground sm:text-sm">
        <span data-favorite-tournament-play-count>
          {copy.playCount.replace("{count}", String(playCount))}
        </span>
      </div>

      <div
        data-favorite-tournament-pool
        className="max-h-[min(20rem,40dvh)] overflow-hidden rounded-xl bg-muted/40"
      >
        <GameScrollArea
          className="max-h-[min(20rem,40dvh)]"
          scrollerClassName="max-h-[min(20rem,40dvh)]"
          size="small"
          aria-label={copy.thumbnailScroll}
        >
          <DecisionsDecisionsBoard
            variant="pool"
            rows={[]}
            placements={[]}
            pool={roster}
            entitiesByKey={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            showNames={false}
            selectedKey={null}
            readOnly
            compact
            thumbnail
          />
        </GameScrollArea>
      </div>
    </div>
  );
}

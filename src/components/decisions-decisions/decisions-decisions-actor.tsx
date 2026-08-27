"use client";

import { useEffect, useRef, useState } from "react";
import { CHARACTER_STAGE_VIEWPORT_PADDING } from "@/components/codex/character-spine-stage";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import Image from "@/components/ui/static-image";
import type { MonsterSpineAsset } from "@/lib/codex-types";

/** Cap live Spine players in a stamped pool so 100 monsters cannot open 100 WebGL contexts. */
const MAX_LIVE_POOL_SPINE = 8;

let liveSpineCount = 0;
const spineWaiters = new Set<() => void>();

function acquirePoolSpineSlot(): boolean {
  if (liveSpineCount >= MAX_LIVE_POOL_SPINE) return false;
  liveSpineCount += 1;
  return true;
}

function releasePoolSpineSlot() {
  liveSpineCount = Math.max(0, liveSpineCount - 1);
  const retry = spineWaiters.values().next().value;
  if (typeof retry === "function") {
    spineWaiters.delete(retry);
    retry();
  }
}

export function DecisionsActorSprite({
  name,
  fallbackUrl,
  spineAsset,
  kind,
}: {
  name: string;
  fallbackUrl: string | null;
  spineAsset: MonsterSpineAsset | null | undefined;
  kind: "character" | "monster";
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !spineAsset) return;

    let cancelled = false;
    let held = false;

    const drop = () => {
      if (!held) return;
      held = false;
      setLive(false);
      releasePoolSpineSlot();
    };

    const tryHold = () => {
      if (cancelled || held) return;
      if (!acquirePoolSpineSlot()) {
        spineWaiters.add(tryHold);
        return;
      }
      held = true;
      spineWaiters.delete(tryHold);
      setLive(true);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        tryHold();
        return;
      }
      spineWaiters.delete(tryHold);
      drop();
    }, { rootMargin: "80px", threshold: 0.01 });

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      spineWaiters.delete(tryHold);
      drop();
    };
  }, [spineAsset]);

  return (
    <span
      ref={rootRef}
      className="relative block h-12 w-12 overflow-hidden"
    >
      {fallbackUrl && !live ? (
        <Image
          src={fallbackUrl}
          alt={name}
          width={48}
          height={48}
          draggable={false}
          className="h-12 w-12 object-contain"
        />
      ) : null}
      {live && spineAsset ? (
        <MonsterSpineStage
          asset={spineAsset}
          fallbackImageUrl={fallbackUrl}
          monsterName={name}
          selectedMoveId="IDLE"
          imagePriority={false}
          showLoadingLabel={false}
          viewportTransitionTime={0}
          viewportPadding={kind === "character" ? CHARACTER_STAGE_VIEWPORT_PADDING : undefined}
          className="absolute inset-0 h-full w-full"
          fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain"
        />
      ) : null}
      {!fallbackUrl && !live ? (
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center font-game-title text-lg font-bold text-primary"
        >
          {name.slice(0, 1)}
        </span>
      ) : null}
    </span>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import Image from "@/components/ui/static-image";
import type { MonsterSpineAsset } from "@/lib/codex-types";

/** Cap live Spine players in a stamped pool so 100 monsters cannot open 100 WebGL contexts. */
const MAX_LIVE_POOL_SPINE = 8;

const liveSpineNodes = new Set<HTMLElement>();
const spineWaiters = new Set<() => void>();

function pruneDisconnectedSpineNodes() {
  for (const node of liveSpineNodes) {
    if (!node.isConnected) liveSpineNodes.delete(node);
  }
}

function acquirePoolSpineSlot(node: HTMLElement): boolean {
  pruneDisconnectedSpineNodes();
  if (liveSpineNodes.has(node)) return true;
  if (liveSpineNodes.size >= MAX_LIVE_POOL_SPINE) return false;
  liveSpineNodes.add(node);
  return true;
}

function releasePoolSpineSlot(node: HTMLElement) {
  liveSpineNodes.delete(node);
  pruneDisconnectedSpineNodes();
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
}: {
  name: string;
  fallbackUrl: string | null;
  spineAsset: MonsterSpineAsset | null | undefined;
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
      releasePoolSpineSlot(node);
    };

    const tryHold = () => {
      if (cancelled || held) return;
      if (!acquirePoolSpineSlot(node)) {
        spineWaiters.add(tryHold);
        return;
      }
      held = true;
      spineWaiters.delete(tryHold);
      setLive(true);
    };

    const inWindow = () => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.bottom > -80
        && rect.top < (window.innerHeight || 0) + 80;
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting || inWindow()) {
        tryHold();
        return;
      }
      spineWaiters.delete(tryHold);
      drop();
    }, { rootMargin: "80px", threshold: 0 });

    observer.observe(node);
    if (inWindow()) tryHold();
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
      data-decisions-actor={spineAsset ? (live ? "live" : "spine") : "static"}
      className="relative block h-12 w-12 overflow-hidden"
    >
      {fallbackUrl ? (
        <Image
          src={fallbackUrl}
          alt={name}
          width={48}
          height={48}
          draggable={false}
          data-drag-preview=""
          className="absolute inset-0 h-12 w-12 object-contain"
        />
      ) : (
        <span
          aria-hidden
          data-drag-preview=""
          className="absolute inset-0 flex items-center justify-center font-game-title text-lg font-bold text-primary"
        >
          {name.slice(0, 1)}
        </span>
      )}
      {live && spineAsset ? (
        <MonsterSpineStage
          asset={spineAsset}
          fallbackImageUrl={fallbackUrl}
          monsterName={name}
          selectedMoveId="IDLE"
          imagePriority={false}
          showLoadingLabel={false}
          viewportTransitionTime={0}
          className="absolute inset-0 z-10 h-full w-full"
          fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain"
        />
      ) : null}
    </span>
  );
}

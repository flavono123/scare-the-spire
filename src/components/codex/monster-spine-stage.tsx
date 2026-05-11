"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpinePlayer } from "@esotericsoftware/spine-player";
import Image from "@/components/ui/static-image";
import type { MonsterSpineAsset } from "@/lib/codex-types";

interface MonsterSpineStageProps {
  asset: MonsterSpineAsset | null;
  fallbackImageUrl: string | null;
  monsterName: string;
  selectedMoveId: string | null;
  className?: string;
}

type LoadState = "loading" | "ready" | "error";

export function MonsterSpineStage({
  asset,
  fallbackImageUrl,
  monsterName,
  selectedMoveId,
  className,
}: MonsterSpineStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SpinePlayer | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(asset ? "loading" : "error");
  const [availableAnimations, setAvailableAnimations] = useState<string[]>(asset?.animations ?? []);
  const selectedAnimation = useMemo(
    () => asset ? resolveSpineAnimation(asset, selectedMoveId, availableAnimations) : null,
    [asset, availableAnimations, selectedMoveId],
  );

  useEffect(() => {
    if (!asset || !containerRef.current) return;

    let disposed = false;
    let player: SpinePlayer | null = null;
    const parent = containerRef.current;

    void import("@esotericsoftware/spine-player")
      .then(({ SpinePlayer: SpinePlayerCtor }) => {
        if (disposed || !containerRef.current) return;

        player = new SpinePlayerCtor(parent, {
          binaryUrl: asset.binaryUrl,
          atlasUrl: asset.atlasUrl,
          animation: asset.idleAnimation,
          animations: asset.animations,
          alpha: true,
          backgroundColor: "00000000",
          preserveDrawingBuffer: false,
          premultipliedAlpha: true,
          showControls: false,
          showLoading: false,
          viewport: {
            padLeft: "4%",
            padRight: "4%",
            padTop: "4%",
            padBottom: "4%",
            transitionTime: 0.12,
          },
          success: (loadedPlayer) => {
            if (disposed) return;
            playerRef.current = loadedPlayer;
            setAvailableAnimations(loadedPlayer.skeleton?.data.animations.map((animation) => animation.name) ?? asset.animations);
            setLoadState("ready");
          },
          error: (_loadedPlayer, message) => {
            if (disposed) return;
            console.warn(`Failed to load Spine asset for ${monsterName}: ${message}`);
            setLoadState("error");
          },
        });
        playerRef.current = player;
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn(`Failed to import Spine player for ${monsterName}:`, error);
        setLoadState("error");
      });

    return () => {
      disposed = true;
      playerRef.current = null;
      player?.dispose();
      parent.replaceChildren();
    };
  }, [asset, monsterName]);

  useEffect(() => {
    if (!asset || loadState !== "ready" || !playerRef.current || !selectedAnimation) return;

    const player = playerRef.current;
    const loops = selectedAnimation === asset.idleAnimation || selectedMoveId == null;
    try {
      player.setAnimation(selectedAnimation, loops);
      if (!loops && asset.idleAnimation && selectedAnimation !== asset.idleAnimation) {
        player.addAnimation(asset.idleAnimation, true, 0);
      }
      player.play();
    } catch (error) {
      console.warn(`Failed to play Spine animation ${selectedAnimation} for ${monsterName}:`, error);
    }
  }, [asset, loadState, monsterName, selectedAnimation, selectedMoveId]);

  return (
    <div className={className}>
      {fallbackImageUrl && loadState !== "ready" && (
        <Image
          src={fallbackImageUrl}
          alt={monsterName}
          width={640}
          height={640}
          className="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"
          priority
        />
      )}
      <div
        ref={containerRef}
        className={`sts2-spine-stage absolute inset-0 z-20 transition-opacity duration-300 ${loadState === "ready" ? "opacity-100" : "opacity-0"}`}
        aria-hidden={loadState !== "ready"}
      />
      {asset && loadState === "loading" && (
        <div className="absolute bottom-4 right-4 z-30 rounded bg-black/30 px-2 py-1 text-[10px] text-gray-400">
          Spine loading
        </div>
      )}
    </div>
  );
}

function resolveSpineAnimation(
  asset: MonsterSpineAsset,
  moveId: string | null,
  availableAnimations: string[],
): string {
  const available = new Set(availableAnimations.length > 0 ? availableAnimations : asset.animations);
  const candidates = [
    ...(moveId ? asset.moveAnimations[moveId] ?? [] : []),
    moveId?.toLowerCase(),
    asset.idleAnimation,
    asset.animations[0],
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => available.has(candidate)) ?? asset.idleAnimation;
}

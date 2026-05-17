"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { SpinePlayer, SpinePlayerConfig } from "@esotericsoftware/spine-player";
import Image from "@/components/ui/static-image";
import type { MonsterSpineAsset, MonsterSpineEffectAsset } from "@/lib/codex-types";

interface MonsterSpineStageProps {
  asset: MonsterSpineAsset | null;
  fallbackImageUrl: string | null;
  monsterName: string;
  selectedMoveId: string | null;
  selectedMoveNonce?: number;
  selectedSkin?: string | null;
  className?: string;
  imagePriority?: boolean;
  showLoadingLabel?: boolean;
}

type LoadState = "loading" | "ready" | "error";
type SpinePlayerCtor = new (element: HTMLElement, config: SpinePlayerConfig) => SpinePlayer;

export function MonsterSpineStage({
  asset,
  fallbackImageUrl,
  monsterName,
  selectedMoveId,
  selectedMoveNonce = 0,
  selectedSkin = null,
  className,
  imagePriority = true,
  showLoadingLabel = true,
}: MonsterSpineStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const vfxContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SpinePlayer | null>(null);
  const vfxPlayerRef = useRef<SpinePlayer | null>(null);
  const vfxTimeoutRef = useRef<number | null>(null);
  const playerCtorRef = useRef<SpinePlayerCtor | null>(null);
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
        playerCtorRef.current = SpinePlayerCtor;
        const viewport = getMonsterViewport(asset.id);

        player = new SpinePlayerCtor(parent, {
          binaryUrl: asset.binaryUrl,
          atlasUrl: asset.atlasUrl,
          animation: asset.idleAnimation,
          animations: asset.animations,
          skin: selectedSkin ?? asset.skin ?? undefined,
          skins: asset.skins,
          alpha: true,
          backgroundColor: "00000000",
          preserveDrawingBuffer: false,
          premultipliedAlpha: false,
          showControls: false,
          showLoading: false,
          viewport,
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
      clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);
      playerRef.current = null;
      player?.dispose();
      parent.replaceChildren();
    };
  }, [asset, monsterName, selectedSkin]);

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
  }, [asset, loadState, monsterName, selectedAnimation, selectedMoveId, selectedMoveNonce]);

  useEffect(() => {
    if (!asset || loadState !== "ready" || !selectedMoveId || !vfxContainerRef.current) return;

    const effect = resolveSpineEffect(asset, selectedMoveId);
    if (!effect) {
      clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);
      return;
    }

    let disposed = false;
    const parent = vfxContainerRef.current;
    clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);

    void import("@esotericsoftware/spine-player")
      .then(({ SpinePlayer: SpinePlayerCtor }) => {
        if (disposed || !vfxContainerRef.current) return;
        playerCtorRef.current = SpinePlayerCtor;

        const vfxPlayer = new SpinePlayerCtor(parent, {
          binaryUrl: effect.binaryUrl,
          atlasUrl: effect.atlasUrl,
          animation: effect.idleAnimation,
          animations: effect.animations,
          alpha: true,
          backgroundColor: "00000000",
          preserveDrawingBuffer: false,
          premultipliedAlpha: false,
          showControls: false,
          showLoading: false,
          viewport: {
            padLeft: "0%",
            padRight: "0%",
            padTop: "0%",
            padBottom: "0%",
            transitionTime: 0,
          },
          success: (loadedPlayer) => {
            if (disposed) return;
            vfxPlayerRef.current = loadedPlayer;
            try {
              loadedPlayer.setAnimation(effect.idleAnimation, false);
              loadedPlayer.play();
            } catch (error) {
              console.warn(`Failed to play Spine VFX ${effect.id} for ${monsterName}:`, error);
            }
            const durationMs = Math.max(250, Math.ceil((effect.durationSeconds || 0.75) * 1000) + 200);
            vfxTimeoutRef.current = window.setTimeout(() => {
              clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);
            }, durationMs);
          },
          error: (_loadedPlayer, message) => {
            if (disposed) return;
            console.warn(`Failed to load Spine VFX ${effect.id} for ${monsterName}: ${message}`);
            clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);
          },
        });
        vfxPlayerRef.current = vfxPlayer;
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn(`Failed to import Spine VFX player for ${monsterName}:`, error);
        clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);
      });

    return () => {
      disposed = true;
    };
  }, [asset, loadState, monsterName, selectedMoveId, selectedMoveNonce]);

  return (
    <div className={className}>
      {fallbackImageUrl && loadState !== "ready" && (
        <Image
          src={fallbackImageUrl}
          alt={monsterName}
          width={640}
          height={640}
          className="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"
          priority={imagePriority}
        />
      )}
      <div
        ref={containerRef}
        className={`sts2-spine-stage absolute inset-0 z-20 transition-opacity duration-300 ${loadState === "ready" ? "opacity-100" : "opacity-0"}`}
        aria-hidden={loadState !== "ready"}
      />
      <div
        ref={vfxContainerRef}
        className="sts2-spine-stage pointer-events-none absolute inset-0 z-30"
        aria-hidden
      />
      {showLoadingLabel && asset && loadState === "loading" && (
        <div className="absolute bottom-4 right-4 z-40 rounded bg-black/30 px-2 py-1 text-[10px] text-gray-400">
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

function resolveSpineEffect(
  asset: MonsterSpineAsset,
  moveId: string,
): MonsterSpineEffectAsset | null {
  return asset.moveEffects[moveId]?.find((effect) => effect.usable !== false) ?? null;
}

function getMonsterViewport(monsterId: string): SpinePlayerConfig["viewport"] {
  if (monsterId === "CUBEX_CONSTRUCT") {
    return {
      padLeft: "18%",
      padRight: "18%",
      padTop: "22%",
      padBottom: "18%",
      transitionTime: 0.12,
    };
  }

  return {
    padLeft: "4%",
    padRight: "4%",
    padTop: "4%",
    padBottom: "4%",
    transitionTime: 0.12,
  };
}

function clearVfx(
  playerRef: MutableRefObject<SpinePlayer | null>,
  containerRef: MutableRefObject<HTMLDivElement | null>,
  timeoutRef: MutableRefObject<number | null>,
) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
  playerRef.current?.dispose();
  playerRef.current = null;
  containerRef.current?.replaceChildren();
}

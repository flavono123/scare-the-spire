"use client";

import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Skin, SpinePlayer, SpinePlayerConfig } from "@esotericsoftware/spine-player";
import Image from "@/components/ui/static-image";
import type { MonsterPhobiaModeScene, MonsterSpineAsset, MonsterSpineEffectAsset, MonsterSpineTrackAnimation } from "@/lib/codex-types";
import { MonsterPhobiaSceneStage } from "./monster-phobia-scene-stage";

interface MonsterSpineStageProps {
  asset: MonsterSpineAsset | null;
  fallbackImageUrl: string | null;
  monsterName: string;
  selectedMoveId: string | null;
  selectedMoveNonce?: number;
  selectedSkin?: string | null;
  selectedSkins?: readonly string[] | null;
  showPhobiaMode?: boolean;
  phobiaModeImageUrl?: string | null;
  phobiaModeScene?: MonsterPhobiaModeScene | null;
  phobiaImageClassName?: string;
  className?: string;
  imagePriority?: boolean;
  showLoadingLabel?: boolean;
  viewportTransitionTime?: number;
  viewportPadding?: SpineViewportPadding;
  fallbackImageClassName?: string;
  onVisualBoundsChange?: (bounds: MonsterStageVisualBounds | null) => void;
}

type LoadState = "loading" | "ready" | "error";
type SpinePlayerCtor = new (element: HTMLElement, config: SpinePlayerConfig) => SpinePlayer;
type SpineSkinCtor = new (name: string) => Skin;
type SpinePhysics = typeof import("@esotericsoftware/spine-player")["Physics"];
type SpineViewportPadding = {
  padLeft?: string;
  padRight?: string;
  padTop?: string;
  padBottom?: string;
};
type ResolvedSpineViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  padLeft?: number;
  padRight?: number;
  padTop?: number;
  padBottom?: number;
};

export interface MonsterStageVisualBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  stageWidth: number;
  stageHeight: number;
}

function MonsterSpineStageComponent({
  asset,
  fallbackImageUrl,
  monsterName,
  selectedMoveId,
  selectedMoveNonce = 0,
  selectedSkin = null,
  selectedSkins = null,
  showPhobiaMode = false,
  phobiaModeImageUrl = null,
  phobiaModeScene = null,
  phobiaImageClassName,
  className,
  imagePriority = true,
  showLoadingLabel = true,
  viewportTransitionTime,
  viewportPadding,
  fallbackImageClassName,
  onVisualBoundsChange,
}: MonsterSpineStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fallbackImageRef = useRef<HTMLImageElement | null>(null);
  const phobiaImageRef = useRef<HTMLImageElement | null>(null);
  const vfxContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SpinePlayer | null>(null);
  const vfxPlayerRef = useRef<SpinePlayer | null>(null);
  const vfxTimeoutRef = useRef<number | null>(null);
  const playerCtorRef = useRef<SpinePlayerCtor | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(asset ? "loading" : "error");
  const showStaticPhobiaMode = showPhobiaMode && Boolean(phobiaModeImageUrl);
  const [availableAnimations, setAvailableAnimations] = useState<string[]>(asset?.animations ?? []);
  const compositeSkinNames = useMemo(
    () => selectedSkins ?? asset?.defaultSkinCombination ?? [],
    [asset?.defaultSkinCombination, selectedSkins],
  );
  const singleSkin = compositeSkinNames.length > 0 ? null : selectedSkin ?? asset?.skin ?? null;
  const selectedAnimation = useMemo(
    () => asset ? resolveSpineAnimation(asset, selectedMoveId, availableAnimations) : null,
    [asset, availableAnimations, selectedMoveId],
  );
  const selectedTrackAnimations = useMemo(
    () => asset && selectedMoveId ? asset.moveAnimationTracks?.[selectedMoveId] ?? null : null,
    [asset, selectedMoveId],
  );

  useEffect(() => {
    if (!asset || !containerRef.current) return;

    let disposed = false;
    let player: SpinePlayer | null = null;
    const parent = containerRef.current;

    void import("@esotericsoftware/spine-player")
      .then(({ SpinePlayer: SpinePlayerCtor, Skin: SpineSkinCtor, Physics }) => {
        if (disposed || !containerRef.current) return;
        playerCtorRef.current = SpinePlayerCtor;
        const viewport = getMonsterViewport(asset, viewportTransitionTime, viewportPadding);

        player = new SpinePlayerCtor(parent, {
          binaryUrl: asset.binaryUrl,
          atlasUrl: asset.atlasUrl,
          animation: asset.idleAnimation,
          animations: asset.animations,
          skin: singleSkin ?? undefined,
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
            applyCompositeSkin(loadedPlayer, SpineSkinCtor, Physics, compositeSkinNames, monsterName);
            applyIdleTracks(loadedPlayer, asset.idleTracks);
            playerRef.current = loadedPlayer;
            setAvailableAnimations(loadedPlayer.skeleton?.data.animations.map((animation) => animation.name) ?? asset.animations);
            setLoadState("ready");
            reportSpineVisualBounds(loadedPlayer, parent, onVisualBoundsChange);
          },
          error: (_loadedPlayer, message) => {
            if (disposed) return;
            console.warn(`Failed to load Spine asset for ${monsterName}: ${message}`);
            setLoadState("error");
            reportImageVisualBounds(fallbackImageRef.current, containerRef.current, onVisualBoundsChange);
          },
        });
        playerRef.current = player;
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn(`Failed to import Spine player for ${monsterName}:`, error);
        setLoadState("error");
        reportImageVisualBounds(fallbackImageRef.current, containerRef.current, onVisualBoundsChange);
      });

    return () => {
      disposed = true;
      clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);
      playerRef.current = null;
      player?.dispose();
      parent.replaceChildren();
    };
  }, [asset, compositeSkinNames, monsterName, onVisualBoundsChange, singleSkin, viewportPadding, viewportTransitionTime]);

  useEffect(() => {
    if (!asset || loadState !== "ready" || !playerRef.current || !selectedAnimation) return;

    const player = playerRef.current;
    const loops = selectedAnimation === asset.idleAnimation || selectedMoveId == null;
    try {
      if (selectedTrackAnimations?.length) {
        restartSpineTrackAnimations(player, selectedTrackAnimations, asset.idleTracks);
      } else {
        restartSpineAnimation(player, selectedAnimation, loops);
      }
      if (!selectedTrackAnimations?.length && !loops && asset.idleAnimation && selectedAnimation !== asset.idleAnimation) {
        const idleEntry = player.addAnimation(asset.idleAnimation, true, 0);
        idleEntry.mixDuration = 0;
        idleEntry.mixTime = 0;
      }
      player.play();
      reportSpineVisualBounds(player, containerRef.current, onVisualBoundsChange);
    } catch (error) {
      console.warn(`Failed to play Spine animation ${selectedAnimation} for ${monsterName}:`, error);
    }
  }, [asset, loadState, monsterName, onVisualBoundsChange, selectedAnimation, selectedMoveId, selectedMoveNonce, selectedTrackAnimations]);

  useEffect(() => {
    if (!onVisualBoundsChange) return;
    if (showStaticPhobiaMode) {
      reportImageVisualBounds(phobiaImageRef.current, containerRef.current, onVisualBoundsChange);
      return;
    }
    if (loadState !== "ready") {
      reportImageVisualBounds(fallbackImageRef.current, containerRef.current, onVisualBoundsChange);
    }
  }, [loadState, onVisualBoundsChange, showStaticPhobiaMode]);

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
      {fallbackImageUrl && loadState !== "ready" && !showStaticPhobiaMode && (
        <Image
          ref={fallbackImageRef}
          src={fallbackImageUrl}
          alt={monsterName}
          width={640}
          height={640}
          className={fallbackImageClassName ?? "absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"}
          priority={imagePriority}
          onLoad={() => reportImageVisualBounds(fallbackImageRef.current, containerRef.current, onVisualBoundsChange)}
        />
      )}
      {showStaticPhobiaMode && phobiaModeImageUrl && (
        phobiaModeScene ? (
          <MonsterPhobiaSceneStage
            imageUrl={phobiaModeImageUrl}
            scene={phobiaModeScene}
            monsterName={monsterName}
            className={phobiaImageClassName ?? "absolute inset-0 z-20 h-full w-full drop-shadow-2xl"}
          />
        ) : (
          <Image
            ref={phobiaImageRef}
            src={phobiaModeImageUrl}
            alt={monsterName}
            width={960}
            height={960}
            className={phobiaImageClassName ?? fallbackImageClassName ?? "absolute inset-0 z-20 h-full w-full object-contain drop-shadow-2xl"}
            priority={imagePriority}
            onLoad={() => reportImageVisualBounds(phobiaImageRef.current, containerRef.current, onVisualBoundsChange)}
          />
        )
      )}
      <div
        ref={containerRef}
        className={`sts2-spine-stage absolute inset-0 z-20 transition-opacity duration-300 ${loadState === "ready" && !showStaticPhobiaMode ? "opacity-100" : "opacity-0"}`}
        aria-hidden={loadState !== "ready" || showStaticPhobiaMode}
      />
      <div
        ref={vfxContainerRef}
        className={`sts2-spine-stage pointer-events-none absolute inset-0 z-30 ${showStaticPhobiaMode ? "opacity-0" : "opacity-100"}`}
        aria-hidden
      />
      {showLoadingLabel && asset && loadState === "loading" && !showStaticPhobiaMode && (
        <div className="absolute bottom-4 right-4 z-40 rounded bg-black/30 px-2 py-1 text-[10px] text-gray-400">
          Spine loading
        </div>
      )}
    </div>
  );
}

export const MonsterSpineStage = memo(MonsterSpineStageComponent);
MonsterSpineStage.displayName = "MonsterSpineStage";

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

function restartSpineAnimation(
  player: SpinePlayer,
  animation: string,
  loop: boolean,
) {
  player.animationState?.clearTrack(0);
  player.skeleton?.setToSetupPose();
  const entry = player.setAnimation(animation, loop);
  entry.mixDuration = 0;
  entry.mixTime = 0;
  entry.trackTime = 0;
  entry.trackLast = -1;
  entry.animationLast = -1;
  entry.alpha = 1;
  return entry;
}

function applyIdleTracks(
  player: SpinePlayer,
  idleTracks: readonly MonsterSpineTrackAnimation[] | undefined,
) {
  if (!idleTracks?.length) return;

  restartSpineTrackAnimations(player, idleTracks);
}

function restartSpineTrackAnimations(
  player: SpinePlayer,
  trackAnimations: readonly MonsterSpineTrackAnimation[],
  idleTracks?: readonly MonsterSpineTrackAnimation[],
) {
  player.animationState?.clearTracks();
  player.skeleton?.setToSetupPose();

  for (const trackAnimation of trackAnimations) {
    const entry = player.animationState?.setAnimation(
      trackAnimation.track,
      trackAnimation.animation,
      trackAnimation.loop ?? true,
    );
    if (!entry) continue;
    entry.mixDuration = 0;
    entry.mixTime = 0;
    entry.trackTime = 0;
    entry.trackLast = -1;
    entry.animationLast = -1;
    entry.alpha = 1;

    if (trackAnimation.loop === false && trackAnimation.idleAnimation) {
      const idleEntry = player.animationState?.addAnimation(
        trackAnimation.track,
        trackAnimation.idleAnimation,
        true,
        0,
      );
      if (idleEntry) {
        idleEntry.mixDuration = 0;
        idleEntry.mixTime = 0;
      }
    }
  }

  const configuredTracks = new Set(trackAnimations.map((trackAnimation) => trackAnimation.track));
  for (const idleTrack of idleTracks ?? []) {
    if (configuredTracks.has(idleTrack.track)) continue;
    const entry = player.animationState?.setAnimation(idleTrack.track, idleTrack.animation, idleTrack.loop ?? true);
    if (!entry) continue;
    entry.mixDuration = 0;
    entry.mixTime = 0;
  }
}

function applyCompositeSkin(
  player: SpinePlayer,
  SkinCtor: SpineSkinCtor,
  physics: SpinePhysics,
  skinNames: readonly string[],
  monsterName: string,
) {
  if (skinNames.length === 0 || !player.skeleton) return;

  const skeleton = player.skeleton;
  const skeletonData = skeleton.data;
  const compositeSkin = new SkinCtor(`combined:${skinNames.join("+")}`);
  const defaultSkin = skeletonData.findSkin("default");
  if (defaultSkin) compositeSkin.addSkin(defaultSkin);

  for (const skinName of skinNames) {
    const skin = skeletonData.findSkin(skinName);
    if (!skin) {
      console.warn(`Missing Spine skin ${skinName} for ${monsterName}`);
      continue;
    }
    compositeSkin.addSkin(skin);
  }

  skeleton.setSkin(compositeSkin);
  skeleton.setSlotsToSetupPose();
  skeleton.updateWorldTransform(physics.update);
}

function getMonsterViewport(
  asset: MonsterSpineAsset,
  transitionTime = 0.12,
  viewportPadding?: SpineViewportPadding,
): SpinePlayerConfig["viewport"] {
  if (asset.viewport) {
    return {
      padLeft: "4%",
      padRight: "4%",
      padTop: "4%",
      padBottom: "4%",
      ...asset.viewport,
      ...viewportPadding,
      transitionTime,
    };
  }

  if (asset.id === "CUBEX_CONSTRUCT") {
    return {
      padLeft: "18%",
      padRight: "18%",
      padTop: "22%",
      padBottom: "18%",
      ...viewportPadding,
      transitionTime,
    };
  }

  return {
    padLeft: "4%",
    padRight: "4%",
    padTop: "4%",
    padBottom: "4%",
    ...viewportPadding,
    transitionTime,
  };
}

export function measureSpinePlayerVisualBounds(
  player: SpinePlayer,
  stageElement: HTMLElement,
): MonsterStageVisualBounds | null {
  const canvas = player.canvas;
  const skeleton = player.skeleton;
  const currentViewport = (player as unknown as { currentViewport?: ResolvedSpineViewport }).currentViewport;
  if (!canvas || !skeleton || !currentViewport || !hasValidViewport(currentViewport)) return null;

  const skeletonBounds = skeleton.getBoundsRect();
  const contentBounds = hasValidWorldRect(skeletonBounds)
    ? skeletonBounds
    : {
        x: currentViewport.x,
        y: currentViewport.y,
        width: currentViewport.width,
        height: currentViewport.height,
      };
  return mapWorldBoundsToStage(contentBounds, currentViewport, canvas, stageElement);
}

function reportSpineVisualBounds(
  player: SpinePlayer,
  stageElement: HTMLElement | null,
  onVisualBoundsChange?: (bounds: MonsterStageVisualBounds | null) => void,
) {
  if (!onVisualBoundsChange || !stageElement) return;
  window.requestAnimationFrame(() => {
    onVisualBoundsChange(measureSpinePlayerVisualBounds(player, stageElement));
  });
}

function reportImageVisualBounds(
  image: HTMLImageElement | null,
  stageElement: HTMLElement | null,
  onVisualBoundsChange?: (bounds: MonsterStageVisualBounds | null) => void,
) {
  if (!onVisualBoundsChange || !image || !stageElement) return;
  window.requestAnimationFrame(() => {
    onVisualBoundsChange(measureContainedImageVisualBounds(image, stageElement));
  });
}

function measureContainedImageVisualBounds(
  image: HTMLImageElement,
  stageElement: HTMLElement,
): MonsterStageVisualBounds | null {
  if (!image.naturalWidth || !image.naturalHeight) return null;

  const imageRect = image.getBoundingClientRect();
  const stageRect = stageElement.getBoundingClientRect();
  const imageAspect = image.naturalWidth / image.naturalHeight;
  const frameAspect = imageRect.width / imageRect.height;
  const width = frameAspect > imageAspect ? imageRect.height * imageAspect : imageRect.width;
  const height = frameAspect > imageAspect ? imageRect.height : imageRect.width / imageAspect;
  const left = imageRect.left - stageRect.left + (imageRect.width - width) / 2;
  const top = imageRect.top - stageRect.top + (imageRect.height - height) / 2;
  const right = left + width;
  const bottom = top + height;
  const clampedLeft = clamp(left, 0, stageRect.width);
  const clampedTop = clamp(top, 0, stageRect.height);
  const clampedRight = clamp(right, 0, stageRect.width);
  const clampedBottom = clamp(bottom, 0, stageRect.height);

  if (clampedRight <= clampedLeft || clampedBottom <= clampedTop) return null;
  return {
    left: clampedLeft,
    top: clampedTop,
    right: clampedRight,
    bottom: clampedBottom,
    width: clampedRight - clampedLeft,
    height: clampedBottom - clampedTop,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
  };
}

function mapWorldBoundsToStage(
  worldBounds: { x: number; y: number; width: number; height: number },
  currentViewport: ResolvedSpineViewport,
  canvas: HTMLCanvasElement,
  stageElement: HTMLElement,
): MonsterStageVisualBounds | null {
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stageElement.getBoundingClientRect();
  const paddedViewport = getPaddedViewport(currentViewport);
  const zoom = canvas.height / canvas.width > paddedViewport.height / paddedViewport.width
    ? paddedViewport.width / canvas.width
    : paddedViewport.height / canvas.height;
  const visibleWorldWidth = canvas.width * zoom;
  const visibleWorldHeight = canvas.height * zoom;
  const worldCenterX = paddedViewport.x + paddedViewport.width / 2;
  const worldCenterY = paddedViewport.y + paddedViewport.height / 2;
  const worldLeft = worldCenterX - visibleWorldWidth / 2;
  const worldTop = worldCenterY + visibleWorldHeight / 2;
  const worldRight = worldBounds.x + worldBounds.width;
  const worldBottom = worldBounds.y;
  const worldBoundsTop = worldBounds.y + worldBounds.height;
  const canvasOffsetLeft = canvasRect.left - stageRect.left;
  const canvasOffsetTop = canvasRect.top - stageRect.top;
  const left = canvasOffsetLeft + ((worldBounds.x - worldLeft) / visibleWorldWidth) * canvasRect.width;
  const right = canvasOffsetLeft + ((worldRight - worldLeft) / visibleWorldWidth) * canvasRect.width;
  const top = canvasOffsetTop + ((worldTop - worldBoundsTop) / visibleWorldHeight) * canvasRect.height;
  const bottom = canvasOffsetTop + ((worldTop - worldBottom) / visibleWorldHeight) * canvasRect.height;
  const clampedLeft = clamp(left, 0, stageRect.width);
  const clampedTop = clamp(top, 0, stageRect.height);
  const clampedRight = clamp(right, 0, stageRect.width);
  const clampedBottom = clamp(bottom, 0, stageRect.height);

  if (clampedRight <= clampedLeft || clampedBottom <= clampedTop) return null;
  return {
    left: clampedLeft,
    top: clampedTop,
    right: clampedRight,
    bottom: clampedBottom,
    width: clampedRight - clampedLeft,
    height: clampedBottom - clampedTop,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
  };
}

function getPaddedViewport(viewport: ResolvedSpineViewport) {
  const padLeft = viewport.padLeft ?? 0;
  const padRight = viewport.padRight ?? 0;
  const padTop = viewport.padTop ?? 0;
  const padBottom = viewport.padBottom ?? 0;

  return {
    x: viewport.x - padLeft,
    y: viewport.y - padBottom,
    width: viewport.width + padLeft + padRight,
    height: viewport.height + padBottom + padTop,
  };
}

function hasValidViewport(viewport: ResolvedSpineViewport): boolean {
  return Number.isFinite(viewport.x)
    && Number.isFinite(viewport.y)
    && Number.isFinite(viewport.width)
    && Number.isFinite(viewport.height)
    && viewport.width > 0
    && viewport.height > 0;
}

function hasValidWorldRect(rect: { x: number; y: number; width: number; height: number }): boolean {
  return Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width > 0
    && rect.height > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

"use client";

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import Image from "@/components/ui/static-image";
import {
  createSpinePlainTextDownloader,
  loadSpinePlayerRuntime,
  type SpinePhysics,
  type SpinePlayer,
  type SpinePlayerConfig,
  type SpineSkinCtor,
} from "@/lib/spine-player-runtime";
import type {
  MonsterPhobiaModeScene,
  MonsterSpineAsset,
  MonsterSpineEffectAsset,
  MonsterSpineTrackAnimation,
  MonsterSpineViewport,
} from "@/lib/codex-types";
import {
  applySpineAtlasDuotone,
  neutralizeSpineSlotTint,
  restoreSpineAtlasDuotone,
  type SpineAtlasDuotone,
} from "@/lib/spine-atlas-duotone";
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
  viewportOverride?: MonsterSpineViewport | null;
  fallbackImageClassName?: string;
  fallbackImageStyle?: CSSProperties;
  loopSelectedMove?: boolean;
  /** Seek to the end of a death clip and hold instead of replaying die. */
  holdDeathPose?: boolean;
  /**
   * Keep the still fallback visible (and the canvas hidden) until a clip has
   * actually been applied. Last-scene combat uses this so a "ready" but blank
   * Spine canvas cannot replace the static monster render.
   */
  keepFallbackUntilPlayed?: boolean;
  /** Fires once after `die` completes (or immediately if already holding a death pose). */
  onDeathAnimationComplete?: () => void;
  formAttachment?: MonsterStageFormAttachment | null;
  formPlacementRef?: MutableRefObject<MonsterStageFormPlacement | null>;
  onVisualBoundsChange?: (bounds: MonsterStageVisualBounds | null) => void;
  onReady?: () => void;
  atlasDuotone?: SpineAtlasDuotone | null;
  skeletonTransform?: {
    coordinateHeight: number;
    position: { x: number; y: number };
    scale: { x: number; y: number };
  } | null;
}

type LoadState = "loading" | "ready" | "error";
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

export interface MonsterStageFormAttachment {
  boneName: string | null;
  initialPosition: readonly [number, number] | readonly number[];
  interpolationSpeed: number;
  snap: boolean;
  visualPosition: readonly [number, number] | readonly number[];
  visualScale: readonly [number, number] | readonly number[];
}

export interface MonsterStageFormPlacement {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

const FORM_VFX_LOGICAL_WIDTH = 2560;
const FORM_VFX_LOGICAL_HEIGHT = 1200;

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
  viewportOverride = null,
  fallbackImageClassName,
  fallbackImageStyle,
  loopSelectedMove = false,
  holdDeathPose = false,
  keepFallbackUntilPlayed = false,
  onDeathAnimationComplete,
  formAttachment = null,
  formPlacementRef,
  onVisualBoundsChange,
  onReady,
  atlasDuotone,
  skeletonTransform = null,
}: MonsterSpineStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fallbackImageRef = useRef<HTMLImageElement | null>(null);
  const phobiaImageRef = useRef<HTMLImageElement | null>(null);
  const vfxContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SpinePlayer | null>(null);
  const vfxPlayerRef = useRef<SpinePlayer | null>(null);
  const vfxTimeoutRef = useRef<number | null>(null);
  const deathPlayedRef = useRef(false);
  const deathStartedRef = useRef(false);
  const [playbackArmed, setPlaybackArmed] = useState(false);
  const onDeathAnimationCompleteRef = useRef(onDeathAnimationComplete);
  onDeathAnimationCompleteRef.current = onDeathAnimationComplete;
  const formAttachmentRef = useRef(formAttachment);
  const formPlacementTargetRef = useRef(formPlacementRef);
  const atlasDuotoneRef = useRef(atlasDuotone);
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
  const hasViewportOverride = viewportOverride !== null;
  const viewportOverrideX = viewportOverride?.x;
  const viewportOverrideY = viewportOverride?.y;
  const viewportOverrideWidth = viewportOverride?.width;
  const viewportOverrideHeight = viewportOverride?.height;
  const viewportOverridePadLeft = viewportOverride?.padLeft;
  const viewportOverridePadRight = viewportOverride?.padRight;
  const viewportOverridePadTop = viewportOverride?.padTop;
  const viewportOverridePadBottom = viewportOverride?.padBottom;
  const stableViewportOverride = useMemo(
    () => hasViewportOverride ? {
      x: viewportOverrideX,
      y: viewportOverrideY,
      width: viewportOverrideWidth,
      height: viewportOverrideHeight,
      padLeft: viewportOverridePadLeft,
      padRight: viewportOverridePadRight,
      padTop: viewportOverridePadTop,
      padBottom: viewportOverridePadBottom,
    } : null,
    [
      hasViewportOverride,
      viewportOverrideHeight,
      viewportOverridePadBottom,
      viewportOverridePadLeft,
      viewportOverridePadRight,
      viewportOverridePadTop,
      viewportOverrideWidth,
      viewportOverrideX,
      viewportOverrideY,
    ],
  );

  useEffect(() => {
    formAttachmentRef.current = formAttachment;
    formPlacementTargetRef.current = formPlacementRef;
    if (formPlacementRef) formPlacementRef.current = null;
  }, [formAttachment, formPlacementRef]);

  useEffect(() => {
    atlasDuotoneRef.current = atlasDuotone;
  }, [atlasDuotone]);

  useEffect(() => {
    if (!asset || !containerRef.current) return;

    let disposed = false;
    let player: SpinePlayer | null = null;
    const parent = containerRef.current;

    void loadSpinePlayerRuntime()
      .then((runtime) => {
        if (disposed || !containerRef.current) return;
        const { SpinePlayer: SpinePlayerCtor, Skin: SpineSkinCtor, Physics } = runtime;
        const viewport = getMonsterViewport(
          asset,
          viewportTransitionTime,
          viewportPadding,
          stableViewportOverride,
        );

        try {
          player = new SpinePlayerCtor(parent, {
            binaryUrl: asset.binaryUrl,
            atlasUrl: asset.atlasUrl,
            skin: singleSkin ?? undefined,
            skins: asset.skins,
            alpha: true,
            backgroundColor: "00000000",
            preserveDrawingBuffer: false,
            premultipliedAlpha: false,
            showControls: false,
            showLoading: false,
            downloader: createSpinePlainTextDownloader(runtime),
            viewport,
            update: (loadedPlayer) => {
              if (skeletonTransform) applySkeletonTransform(loadedPlayer, skeletonTransform);
              if (atlasDuotoneRef.current && loadedPlayer.skeleton?.slots) {
                try {
                  neutralizeSpineSlotTint(loadedPlayer);
                } catch {
                  // Slot tint neutralization must not abort Spine loading/rendering.
                }
              }
              const target = formPlacementTargetRef.current;
              if (target) {
                const attachment = formAttachmentRef.current;
                const next = measureSpinePlayerFormPlacement(
                  loadedPlayer,
                  parent,
                  attachment,
                );
                if (!next || !attachment) {
                  target.current = null;
                } else if (attachment.snap) {
                  target.current = next;
                } else {
                  const current = target.current ?? measureSpinePlayerFormPlacement(
                    loadedPlayer,
                    parent,
                    attachment,
                    true,
                  ) ?? next;
                  const speed = clamp(attachment.interpolationSpeed, 0, 1);
                  target.current = {
                    x: current.x + (next.x - current.x) * speed,
                    y: current.y + (next.y - current.y) * speed,
                    scaleX: next.scaleX,
                    scaleY: next.scaleY,
                  };
                }
              }
            },
            success: (loadedPlayer) => {
              if (disposed) return;
              if (skeletonTransform) applySkeletonTransform(loadedPlayer, skeletonTransform);
              applyCompositeSkin(loadedPlayer, SpineSkinCtor, Physics, compositeSkinNames, monsterName);
              applyIdleTracks(loadedPlayer, asset.idleTracks);
              playerRef.current = loadedPlayer;
              setAvailableAnimations(loadedPlayer.skeleton?.data.animations.map((animation) => animation.name) ?? asset.animations);
              setLoadState("ready");
              try {
                if (atlasDuotoneRef.current) {
                  applySpineAtlasDuotone(loadedPlayer, atlasDuotoneRef.current, asset.atlasUrl);
                }
              } catch (error: unknown) {
                console.warn(`Failed to apply Spine atlas duotone for ${monsterName}:`, error);
              }
              reportSpineVisualBounds(loadedPlayer, parent, onVisualBoundsChange);
              window.requestAnimationFrame(() => {
                if (!disposed) window.requestAnimationFrame(() => {
                  if (!disposed) onReady?.();
                });
              });
            },
            error: (_loadedPlayer, message) => {
              if (disposed) return;
              console.warn(`Failed to load Spine asset for ${monsterName}: ${message}`);
              setLoadState("error");
              reportImageVisualBounds(fallbackImageRef.current, containerRef.current, onVisualBoundsChange);
            },
          });
          playerRef.current = player;
        } catch (error: unknown) {
          if (disposed) return;
          console.warn(`Failed to load Spine asset for ${monsterName}:`, error);
          setLoadState("error");
          reportImageVisualBounds(fallbackImageRef.current, containerRef.current, onVisualBoundsChange);
        }
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
      if (formPlacementTargetRef.current) formPlacementTargetRef.current.current = null;
      playerRef.current = null;
      try {
        restoreSpineAtlasDuotone(player, asset.atlasUrl);
      } catch {
        // Restore is best-effort; the player is being disposed next.
      }
      releaseSpinePlayer(player);
      parent.replaceChildren();
    };
  }, [asset, compositeSkinNames, monsterName, onReady, onVisualBoundsChange, singleSkin, skeletonTransform, stableViewportOverride, viewportPadding, viewportTransitionTime]);

  const duotoneShadow = atlasDuotone?.shadow ?? null;
  const duotoneHighlight = atlasDuotone?.highlight ?? null;
  const skipAtlasDuotone = atlasDuotone === undefined;

  useEffect(() => {
    if (loadState !== "ready" || !playerRef.current || skipAtlasDuotone) return;
    try {
      applySpineAtlasDuotone(
        playerRef.current,
        duotoneShadow && duotoneHighlight
          ? { shadow: duotoneShadow, highlight: duotoneHighlight }
          : null,
        asset?.atlasUrl,
      );
    } catch (error: unknown) {
      console.warn("Failed to apply Spine atlas duotone:", error);
    }
  }, [asset?.atlasUrl, duotoneHighlight, duotoneShadow, loadState, skipAtlasDuotone]);

  useEffect(() => {
    if (loadState !== "ready" || !playerRef.current || !containerRef.current) return;
    const player = playerRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = !document.hidden;
    let intersecting = true;
    const updatePlayback = () => {
      if (visible && intersecting && !reducedMotion) player.play();
      else player.pause();
    };
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          intersecting = entry?.isIntersecting !== false;
          updatePlayback();
        }, { rootMargin: "120px" })
      : null;
    observer?.observe(containerRef.current);
    const onVisibilityChange = () => {
      visible = !document.hidden;
      updatePlayback();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    updatePlayback();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadState]);

  useEffect(() => {
    setPlaybackArmed(false);
  }, [asset?.atlasUrl, asset?.binaryUrl]);

  useEffect(() => {
    deathPlayedRef.current = false;
    deathStartedRef.current = false;
  }, [selectedMoveId, selectedMoveNonce]);

  useEffect(() => {
    if (!asset || loadState !== "ready" || !playerRef.current) return;

    const player = playerRef.current;
    const isDeadMove = isDeathMoveId(selectedMoveId);
    const available = new Set(
      availableAnimations.length > 0 ? availableAnimations : asset.animations,
    );
    const deathClip = isDeadMove ? deathAnimationCandidates(asset, available)[0] ?? null : null;
    const loops =
      !isDeadMove &&
      Boolean(selectedAnimation) &&
      (selectedAnimation === asset.idleAnimation || selectedMoveId == null || loopSelectedMove);

    const armPlayback = () => {
      if (!keepFallbackUntilPlayed) return;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setPlaybackArmed(true));
      });
    };

    try {
      if (isDeadMove) {
        if (!deathClip) {
          // Do not latch death onto idle. Keep the still fallback visible.
          return;
        }
        if (holdDeathPose) {
          if (!deathStartedRef.current && !deathPlayedRef.current) {
            const entry = restartSpineAnimation(player, deathClip, false);
            seekSpineAnimationToEnd(entry);
            const deadLoop = resolveDeathHoldAnimation(asset, deathClip, available);
            if (deadLoop && available.has(deadLoop)) {
              const hold = player.addAnimation(deadLoop, true, 0);
              hold.mixDuration = 0;
              hold.mixTime = 0;
              seekSpineAnimationToEnd(hold);
            }
            deathStartedRef.current = true;
            deathPlayedRef.current = true;
            onDeathAnimationCompleteRef.current?.();
          }
          armPlayback();
        } else if (!deathStartedRef.current) {
          deathStartedRef.current = true;
          const entry = restartSpineAnimation(player, deathClip, false);
          const deadLoop = resolveDeathHoldAnimation(asset, deathClip, available);
          if (deadLoop && available.has(deadLoop)) {
            const hold = player.addAnimation(deadLoop, true, 0);
            hold.mixDuration = 0;
            hold.mixTime = 0;
            entry.listener = {
              complete: () => {
                deathPlayedRef.current = true;
                onDeathAnimationCompleteRef.current?.();
              },
            };
          } else {
            entry.listener = {
              complete: () => {
                seekSpineAnimationToEnd(entry);
                deathPlayedRef.current = true;
                onDeathAnimationCompleteRef.current?.();
              },
            };
          }
          armPlayback();
        }
      } else if (selectedTrackAnimations?.length) {
        restartSpineTrackAnimations(player, selectedTrackAnimations, asset.idleTracks);
        armPlayback();
      } else if (selectedAnimation) {
        const entry = restartSpineAnimation(player, selectedAnimation, loops);
        if (!loops && asset.idleAnimation && selectedAnimation !== asset.idleAnimation) {
          const idleEntry = player.addAnimation(asset.idleAnimation, true, 0);
          idleEntry.mixDuration = 0;
          idleEntry.mixTime = 0;
        }
        void entry;
        armPlayback();
      } else {
        return;
      }
      player.play();
      reportSpineVisualBounds(player, containerRef.current, onVisualBoundsChange);
    } catch (error) {
      console.warn(
        `Failed to play Spine animation ${deathClip ?? selectedAnimation} for ${monsterName}:`,
        error,
      );
    }
  }, [
    asset,
    availableAnimations,
    holdDeathPose,
    keepFallbackUntilPlayed,
    loadState,
    loopSelectedMove,
    monsterName,
    onVisualBoundsChange,
    selectedAnimation,
    selectedMoveId,
    selectedMoveNonce,
    selectedTrackAnimations,
  ]);

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

    void loadSpinePlayerRuntime()
      .then((runtime) => {
        if (disposed || !vfxContainerRef.current) return;
        const { SpinePlayer: SpinePlayerCtor } = runtime;

        try {
          const vfxPlayer = new SpinePlayerCtor(parent, {
          binaryUrl: effect.binaryUrl,
          atlasUrl: effect.atlasUrl,
          alpha: true,
          backgroundColor: "00000000",
          preserveDrawingBuffer: false,
          premultipliedAlpha: false,
          showControls: false,
          showLoading: false,
          downloader: createSpinePlainTextDownloader(runtime),
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
        } catch (error: unknown) {
          if (disposed) return;
          console.warn(`Failed to load Spine VFX ${effect.id} for ${monsterName}:`, error);
          clearVfx(vfxPlayerRef, vfxContainerRef, vfxTimeoutRef);
        }
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

  const showStillFallback = Boolean(
    fallbackImageUrl
    && !showStaticPhobiaMode
    && (loadState !== "ready" || (keepFallbackUntilPlayed && !playbackArmed)),
  );
  const showSpineCanvas = loadState === "ready"
    && !showStaticPhobiaMode
    && (!keepFallbackUntilPlayed || playbackArmed);

  return (
    <div className={className}>
      {showStillFallback && fallbackImageUrl && (
        <Image
          ref={fallbackImageRef}
          src={fallbackImageUrl}
          alt={monsterName}
          width={640}
          height={640}
          className={fallbackImageClassName ?? "absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"}
          style={fallbackImageStyle}
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
        className={`sts2-spine-stage absolute inset-0 z-20 ${keepFallbackUntilPlayed ? "" : "transition-opacity duration-300"} ${showSpineCanvas ? "opacity-100" : "opacity-0"}`}
        style={keepFallbackUntilPlayed ? { opacity: showSpineCanvas ? 1 : 0, transition: "none" } : undefined}
        aria-hidden={!showSpineCanvas}
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

function applySkeletonTransform(
  player: SpinePlayer,
  transform: NonNullable<MonsterSpineStageProps["skeletonTransform"]>,
) {
  if (!player.skeleton) return;
  player.skeleton.x = transform.position.x;
  player.skeleton.y = transform.coordinateHeight - transform.position.y;
  player.skeleton.scaleX = transform.scale.x;
  player.skeleton.scaleY = transform.scale.y;
}

function isDeathMoveId(moveId: string | null | undefined): boolean {
  if (!moveId) return false;
  const id = moveId.toUpperCase();
  return id === "DEAD" || id === "DIE";
}

function isIdleAnimationName(name: string): boolean {
  return name.toLowerCase().includes("idle");
}

function deathAnimationCandidates(
  asset: MonsterSpineAsset,
  available: Set<string>,
): string[] {
  const named = [
    ...(asset.moveAnimations.DEAD ?? []),
    ...(asset.moveAnimations.die ?? []),
    "die",
    "dead",
    "dead_loop",
    "dead_static",
    "die_buffed",
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of named) {
    if (!name || isIdleAnimationName(name) || seen.has(name) || !available.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function resolveSpineAnimation(
  asset: MonsterSpineAsset,
  moveId: string | null,
  availableAnimations: string[],
): string {
  const available = new Set(availableAnimations.length > 0 ? availableAnimations : asset.animations);
  if (isDeathMoveId(moveId)) {
    const death = deathAnimationCandidates(asset, available);
    if (death[0]) return death[0];
  }
  const candidates = [
    ...(moveId ? asset.moveAnimations[moveId] ?? [] : []),
    moveId?.toLowerCase(),
    asset.idleAnimation,
    asset.animations[0],
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => available.has(candidate)) ?? asset.idleAnimation;
}

function resolveDeathHoldAnimation(
  asset: MonsterSpineAsset,
  selectedAnimation: string,
  available: Set<string>,
): string | null {
  for (const name of ["dead_loop", "dead_static"]) {
    if (name !== selectedAnimation && available.has(name)) return name;
  }
  const fromDead = (asset.moveAnimations.DEAD ?? []).find(
    (name) =>
      name !== selectedAnimation
      && !isIdleAnimationName(name)
      && name.toLowerCase().includes("dead")
      && available.has(name),
  );
  return fromDead ?? null;
}

function seekSpineAnimationToEnd(entry: {
  animation?: { duration?: number } | null;
  trackTime: number;
  trackLast: number;
  animationLast: number;
}) {
  const duration = entry.animation?.duration ?? 0;
  if (duration <= 0) return;
  entry.trackTime = duration;
  entry.trackLast = duration;
  entry.animationLast = duration;
}

function resolveSpineEffect(
  asset: MonsterSpineAsset,
  moveId: string,
): MonsterSpineEffectAsset | null {
  const keys = isDeathMoveId(moveId) ? [moveId, "DEAD", "DIE", "die"] : [moveId];
  for (const key of keys) {
    const found = asset.moveEffects[key]?.find((effect) => effect.usable !== false) ?? null;
    if (found) return found;
  }
  return null;
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
  viewportOverride?: MonsterSpineViewport | null,
): SpinePlayerConfig["viewport"] {
  const viewport = viewportOverride ?? asset.viewport;
  if (viewport) {
    return {
      padLeft: "4%",
      padRight: "4%",
      padTop: "4%",
      padBottom: "4%",
      ...viewport,
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

export function measureSpinePlayerFormPlacement(
  player: SpinePlayer,
  stageElement: HTMLElement,
  attachment: MonsterStageFormAttachment | null,
  useInitialPosition = false,
): MonsterStageFormPlacement | null {
  if (!attachment) return null;
  const canvas = player.canvas;
  const skeleton = player.skeleton;
  const currentViewport = (player as unknown as { currentViewport?: ResolvedSpineViewport }).currentViewport;
  if (!canvas || !skeleton || !currentViewport || !hasValidViewport(currentViewport)) return null;

  const visualScaleX = Math.abs(attachment.visualScale[0] ?? 0);
  const visualScaleY = Math.abs(attachment.visualScale[1] ?? 0);
  if (!visualScaleX || !visualScaleY) return null;

  const bone = attachment.boneName ? skeleton.findBone(attachment.boneName) : null;
  if (attachment.boneName && !bone) return null;
  const gameX = useInitialPosition ? attachment.initialPosition[0] ?? 0 : 0;
  const gameY = useInitialPosition ? attachment.initialPosition[1] ?? 0 : 0;
  const worldX = bone && !useInitialPosition
    ? skeleton.x + bone.worldX
    : skeleton.x + (gameX - (attachment.visualPosition[0] ?? 0)) / visualScaleX;
  const worldY = bone && !useInitialPosition
    ? skeleton.y + bone.worldY
    : skeleton.y + ((attachment.visualPosition[1] ?? 0) - gameY) / visualScaleY;
  const projection = getWorldStageProjection(currentViewport, canvas, stageElement);
  if (!projection) return null;

  return {
    x: (projection.canvasOffsetLeft + (worldX - projection.worldLeft) * projection.pixelsPerWorldX)
      / projection.stageWidth * FORM_VFX_LOGICAL_WIDTH,
    y: (projection.canvasOffsetTop + (projection.worldTop - worldY) * projection.pixelsPerWorldY)
      / projection.stageHeight * FORM_VFX_LOGICAL_HEIGHT,
    scaleX: projection.pixelsPerWorldX / visualScaleX
      / projection.stageWidth * FORM_VFX_LOGICAL_WIDTH,
    scaleY: projection.pixelsPerWorldY / visualScaleY
      / projection.stageHeight * FORM_VFX_LOGICAL_HEIGHT,
  };
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
  const projection = getWorldStageProjection(currentViewport, canvas, stageElement);
  if (!projection) return null;
  const worldRight = worldBounds.x + worldBounds.width;
  const worldBottom = worldBounds.y;
  const worldBoundsTop = worldBounds.y + worldBounds.height;
  const left = projection.canvasOffsetLeft + (worldBounds.x - projection.worldLeft) * projection.pixelsPerWorldX;
  const right = projection.canvasOffsetLeft + (worldRight - projection.worldLeft) * projection.pixelsPerWorldX;
  const top = projection.canvasOffsetTop + (projection.worldTop - worldBoundsTop) * projection.pixelsPerWorldY;
  const bottom = projection.canvasOffsetTop + (projection.worldTop - worldBottom) * projection.pixelsPerWorldY;
  const clampedLeft = clamp(left, 0, projection.stageWidth);
  const clampedTop = clamp(top, 0, projection.stageHeight);
  const clampedRight = clamp(right, 0, projection.stageWidth);
  const clampedBottom = clamp(bottom, 0, projection.stageHeight);

  if (clampedRight <= clampedLeft || clampedBottom <= clampedTop) return null;
  return {
    left: clampedLeft,
    top: clampedTop,
    right: clampedRight,
    bottom: clampedBottom,
    width: clampedRight - clampedLeft,
    height: clampedBottom - clampedTop,
    stageWidth: projection.stageWidth,
    stageHeight: projection.stageHeight,
  };
}

function getWorldStageProjection(
  currentViewport: ResolvedSpineViewport,
  canvas: HTMLCanvasElement,
  stageElement: HTMLElement,
) {
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stageElement.getBoundingClientRect();
  if (!canvas.width || !canvas.height || !canvasRect.width || !canvasRect.height || !stageRect.width || !stageRect.height) {
    return null;
  }
  const paddedViewport = getPaddedViewport(currentViewport);
  const zoom = canvas.height / canvas.width > paddedViewport.height / paddedViewport.width
    ? paddedViewport.width / canvas.width
    : paddedViewport.height / canvas.height;
  const visibleWorldWidth = canvas.width * zoom;
  const visibleWorldHeight = canvas.height * zoom;
  const worldCenterX = paddedViewport.x + paddedViewport.width / 2;
  const worldCenterY = paddedViewport.y + paddedViewport.height / 2;

  return {
    canvasOffsetLeft: canvasRect.left - stageRect.left,
    canvasOffsetTop: canvasRect.top - stageRect.top,
    pixelsPerWorldX: canvasRect.width / visibleWorldWidth,
    pixelsPerWorldY: canvasRect.height / visibleWorldHeight,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
    worldLeft: worldCenterX - visibleWorldWidth / 2,
    worldTop: worldCenterY + visibleWorldHeight / 2,
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
  releaseSpinePlayer(playerRef.current);
  playerRef.current = null;
  containerRef.current?.replaceChildren();
}

function releaseSpinePlayer(player: SpinePlayer | null) {
  if (!player) return;

  try {
    const gl = player.canvas?.getContext("webgl2") ?? player.canvas?.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Best-effort cleanup only; dispose below still releases the Spine player.
  }

  player.dispose();
}

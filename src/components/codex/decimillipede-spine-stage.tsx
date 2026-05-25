"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { SpinePlayer, SpinePlayerConfig } from "@esotericsoftware/spine-player";
import Image from "@/components/ui/static-image";

interface DecimillipedeSpineStageProps {
  fallbackImageUrl: string | null;
  monsterName: string;
  selectedMoveId: string | null;
  selectedMoveNonce?: number;
  mode?: "encounter" | "part";
  partId?: DecimillipedePartId;
  showPhobiaMode?: boolean;
  phobiaModeImageUrl?: string | null;
  className?: string;
  imagePriority?: boolean;
  showLoadingLabel?: boolean;
  fallbackImageClassName?: string;
}

type LoadState = "loading" | "ready" | "error";
type SpinePlayerCtor = new (element: HTMLElement, config: SpinePlayerConfig) => SpinePlayer;
export type DecimillipedePartId = "back" | "middle" | "front";

interface DecimillipedePart {
  id: string;
  partId: DecimillipedePartId;
  labelKo: string;
  labelEn: string;
  atlasUrl: string;
  binaryUrl: string;
  animationIds: string[];
  spineX: number;
  spineY: number;
  standaloneOffsetX: number;
  boneTargets: Record<string, { x: number; y: number }>;
  zIndex: number;
}

const DECIMILLIPEDE_ENCOUNTER_X_OFFSET = -459;
const DECIMILLIPEDE_GAME_SCREEN_HEIGHT = 1080;
const DECIMILLIPEDE_SPINE_SCALE_X = -0.45;
const DECIMILLIPEDE_SPINE_SCALE_Y = 0.45;
// Source: bestiary_layout_decimillipede.tscn + decimillipede_elite.tscn slots.
// Browser actors match the game scene slot order, then mirror the Spine skeletons like the encounter.
const DECIMILLIPEDE_VIEWPORT = {
  x: 420,
  y: 240,
  width: 1120,
  height: 620,
} as const;

function toBrowserSpineY(godotY: number): number {
  return DECIMILLIPEDE_GAME_SCREEN_HEIGHT - godotY;
}

function applyDecimillipedeTransform(
  player: SpinePlayer,
  part: DecimillipedePart,
  stageMode: "encounter" | "part",
  attackOffsetX = 0,
) {
  player.skeleton.x = part.spineX + (stageMode === "part" ? part.standaloneOffsetX : 0);
  player.skeleton.y = part.spineY;
  player.skeleton.scaleX = DECIMILLIPEDE_SPINE_SCALE_X;
  player.skeleton.scaleY = DECIMILLIPEDE_SPINE_SCALE_Y;
  for (const [boneName, target] of Object.entries(part.boneTargets)) {
    const bone = player.skeleton.findBone(boneName);
    if (!bone) continue;
    bone.x = target.x + attackOffsetX;
    bone.y = target.y;
  }
  player.skeleton.updateWorldTransform(2);
}

function decimillipedeAttackOffsetX(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs) / 1000;
  if (elapsed < 0.4) return easeInOutSine(elapsed / 0.4) * -100;
  if (elapsed < 0.5) return lerp(-100, 100, easeInOutSine((elapsed - 0.4) / 0.1));
  if (elapsed < 1.25) return lerp(100, 0, easeInOutSine((elapsed - 0.5) / 0.75));
  return 0;
}

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * Math.min(1, Math.max(0, value))) - 1) / 2;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

const DECIMILLIPEDE_PARTS: DecimillipedePart[] = [
  {
    id: "segment1-back-model",
    partId: "back",
    labelKo: "뒤쪽",
    labelEn: "Back",
    atlasUrl: "/spine/sts2/monsters/decimillipede_back/decimillipede_back.atlas",
    binaryUrl: "/spine/sts2/monsters/decimillipede_back/decimillipede3.skel",
    animationIds: [
      "dead_loop",
      "dead_static",
      "hurt",
      "idle_loop",
      "regenerate",
      "wither",
      "alt_track/writhe_attack",
      "alt_track/writhe_die",
      "alt_track/writhe_idle",
    ],
    spineX: 1103 + DECIMILLIPEDE_ENCOUNTER_X_OFFSET + 318,
    spineY: toBrowserSpineY(740 - 19),
    standaloneOffsetX: 210,
    boneTargets: {
      link_r_3: { x: 286.667, y: 275.556 },
    },
    zIndex: 10,
  },
  {
    id: "segment2-middle-model",
    partId: "middle",
    labelKo: "가운데",
    labelEn: "Middle",
    atlasUrl: "/spine/sts2/monsters/decimillipede_middle/decimillipede_middle.atlas",
    binaryUrl: "/spine/sts2/monsters/decimillipede_middle/decimillipede2.skel",
    animationIds: [
      "dead_loop",
      "dead_Static",
      "hurt",
      "idle_loop",
      "regenerate",
      "wither",
      "alt_track/writhe_attack",
      "alt_track/writhe_die",
      "alt_track/writhe_idle",
    ],
    spineX: 1451 + DECIMILLIPEDE_ENCOUNTER_X_OFFSET - 54,
    spineY: toBrowserSpineY(740 - 43),
    standaloneOffsetX: 0,
    boneTargets: {
      link_l_2: { x: -442.222, y: 202.222 },
      link_r_2: { x: 220, y: 228.889 },
    },
    zIndex: 20,
  },
  {
    id: "segment3-front-model",
    partId: "front",
    labelKo: "앞쪽",
    labelEn: "Front",
    atlasUrl: "/spine/sts2/monsters/decimillipede_front/decimillipede_front.atlas",
    binaryUrl: "/spine/sts2/monsters/decimillipede_front/decimillipede1.skel",
    animationIds: [
      "dead_loop",
      "dead_static",
      "hurt",
      "idle_loop",
      "regenerate",
      "wither",
      "alt_track/writhe_attack",
      "alt_track/writhe_die",
      "alt_track/writhe_idle",
    ],
    spineX: 1797 + DECIMILLIPEDE_ENCOUNTER_X_OFFSET - 344,
    spineY: toBrowserSpineY(740 - 28),
    standaloneOffsetX: -290,
    boneTargets: {
      link_l_1: { x: -344.445, y: 228.889 },
    },
    zIndex: 30,
  },
];

export const DECIMILLIPEDE_PART_OPTIONS = DECIMILLIPEDE_PARTS.map((part) => ({
  id: part.partId,
  labelKo: part.labelKo,
  labelEn: part.labelEn,
}));

export const DecimillipedeSpineStage = memo(function DecimillipedeSpineStage({
  fallbackImageUrl,
  monsterName,
  selectedMoveId,
  selectedMoveNonce = 0,
  mode = "encounter",
  partId = "middle",
  showPhobiaMode = false,
  phobiaModeImageUrl = null,
  className,
  imagePriority = true,
  showLoadingLabel = true,
  fallbackImageClassName,
}: DecimillipedeSpineStageProps) {
  const partRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const playerRefs = useRef<Record<string, SpinePlayer | null>>({});
  const selectedAnimationRef = useRef("idle_loop");
  const animationStartRef = useRef(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const showStaticPhobiaMode = showPhobiaMode && Boolean(phobiaModeImageUrl);
  const selectedAnimation = useMemo(
    () => resolveDecimillipedeAnimation(selectedMoveId),
    [selectedMoveId],
  );
  const visibleParts = useMemo(() => {
    if (mode === "encounter") return DECIMILLIPEDE_PARTS;
    return DECIMILLIPEDE_PARTS.filter((part) => part.partId === partId);
  }, [mode, partId]);

  useEffect(() => {
    selectedAnimationRef.current = selectedAnimation;
    animationStartRef.current = performance.now();
  }, [selectedAnimation, selectedMoveNonce]);

  useEffect(() => {
    let disposed = false;
    const createdPlayers: SpinePlayer[] = [];
    const mountedPartRefs = { ...partRefs.current };
    let readyCount = 0;
    setLoadState("loading");

    void import("@esotericsoftware/spine-player")
      .then(({ SpinePlayer: SpinePlayerCtor }) => {
        for (const part of visibleParts) {
          const parent = mountedPartRefs[part.id];
          if (!parent || disposed) continue;
          const player = new (SpinePlayerCtor as SpinePlayerCtor)(parent, {
            binaryUrl: part.binaryUrl,
            atlasUrl: part.atlasUrl,
            animation: "idle_loop",
            animations: part.animationIds,
            alpha: true,
            backgroundColor: "00000000",
            preserveDrawingBuffer: false,
            premultipliedAlpha: false,
            showControls: false,
            showLoading: false,
            viewport: {
              ...DECIMILLIPEDE_VIEWPORT,
              padLeft: "0%",
              padRight: "0%",
              padTop: "0%",
              padBottom: "0%",
              transitionTime: 0,
            },
            update: (loadedPlayer) => {
              const attackOffsetX =
                selectedAnimationRef.current === "alt_track/writhe_attack"
                  ? decimillipedeAttackOffsetX(performance.now() - animationStartRef.current)
                  : 0;
              applyDecimillipedeTransform(loadedPlayer, part, mode, attackOffsetX);
            },
            success: (loadedPlayer) => {
              if (disposed) return;
              applyDecimillipedeTransform(loadedPlayer, part, mode);
              playerRefs.current[part.id] = loadedPlayer;
              readyCount += 1;
              if (readyCount === visibleParts.length) setLoadState("ready");
            },
            error: (_loadedPlayer, message) => {
              if (disposed) return;
              console.warn(`Failed to load Decimillipede Spine part ${part.id} for ${monsterName}: ${message}`);
              setLoadState("error");
            },
          });
          playerRefs.current[part.id] = player;
          createdPlayers.push(player);
        }
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn(`Failed to import Spine player for ${monsterName}:`, error);
        setLoadState("error");
      });

    return () => {
      disposed = true;
      playerRefs.current = {};
      for (const player of createdPlayers) player.dispose();
      for (const part of visibleParts) mountedPartRefs[part.id]?.replaceChildren();
    };
  }, [mode, monsterName, visibleParts]);

  useEffect(() => {
    if (loadState !== "ready") return;
    for (const part of visibleParts) {
      const player = playerRefs.current[part.id];
      if (!player) continue;
      const animation = part.animationIds.includes(selectedAnimation) ? selectedAnimation : "idle_loop";
      const loop = animation === "idle_loop" || animation === "dead_loop";
      try {
        applyDecimillipedeTransform(player, part, mode);
        player.animationState?.clearTrack(0);
        player.skeleton?.setToSetupPose();
        applyDecimillipedeTransform(player, part, mode);
        const entry = player.setAnimation(animation, loop);
        entry.mixDuration = 0;
        entry.mixTime = 0;
        entry.trackTime = 0;
        entry.trackLast = -1;
        entry.animationLast = -1;
        if (!loop) {
          const idleAnimation = animation === "wither" ? "dead_loop" : "idle_loop";
          const idleEntry = player.addAnimation(idleAnimation, true, 0);
          idleEntry.mixDuration = 0;
          idleEntry.mixTime = 0;
        }
        player.play();
      } catch (error) {
        console.warn(`Failed to play Decimillipede animation ${animation} for ${monsterName}:`, error);
      }
    }
  }, [loadState, mode, monsterName, selectedAnimation, selectedMoveNonce, visibleParts]);

  return (
    <div className={className}>
      {fallbackImageUrl && loadState !== "ready" && !showStaticPhobiaMode && (
        <Image
          src={fallbackImageUrl}
          alt={monsterName}
          width={960}
          height={420}
          className={fallbackImageClassName ?? "absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"}
          priority={imagePriority}
        />
      )}
      {showStaticPhobiaMode && phobiaModeImageUrl && (
        <Image
          src={phobiaModeImageUrl}
          alt={monsterName}
          width={1400}
          height={600}
          className={fallbackImageClassName ?? "absolute inset-0 z-30 h-full w-full translate-y-[6%] scale-[0.92] object-contain drop-shadow-2xl"}
          priority={imagePriority}
        />
      )}
      <div
        className={`absolute inset-0 z-20 transition-opacity duration-300 ${loadState === "ready" && !showStaticPhobiaMode ? "opacity-100" : "opacity-0"}`}
        aria-hidden={loadState !== "ready" || showStaticPhobiaMode}
      >
        {visibleParts.map((part) => (
          <div
            key={part.id}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: part.zIndex }}
          >
            <div
              ref={(node) => {
                partRefs.current[part.id] = node;
              }}
              className="sts2-spine-stage h-full w-full"
            />
          </div>
        ))}
      </div>
      {showLoadingLabel && loadState === "loading" && !showStaticPhobiaMode && (
        <div className="absolute bottom-4 right-4 z-40 rounded bg-black/30 px-2 py-1 text-[10px] text-gray-400">
          Spine loading
        </div>
      )}
    </div>
  );
});

function resolveDecimillipedeAnimation(moveId: string | null): string {
  switch (moveId) {
    case "WRITHE":
    case "BULK":
    case "CONSTRICT":
      return "alt_track/writhe_attack";
    case "REATTACH":
      return "regenerate";
    case "DEAD":
      return "wither";
    default:
      return "idle_loop";
  }
}

"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { SpinePlayer, SpinePlayerConfig } from "@esotericsoftware/spine-player";
import Image from "@/components/ui/static-image";

interface DecimillipedeSpineStageProps {
  fallbackImageUrl: string | null;
  monsterName: string;
  selectedMoveId: string | null;
  selectedMoveNonce?: number;
  className?: string;
  imagePriority?: boolean;
  showLoadingLabel?: boolean;
  fallbackImageClassName?: string;
}

type LoadState = "loading" | "ready" | "error";
type SpinePlayerCtor = new (element: HTMLElement, config: SpinePlayerConfig) => SpinePlayer;

interface DecimillipedePart {
  id: string;
  atlasUrl: string;
  binaryUrl: string;
  animationIds: string[];
  spineX: number;
  spineY: number;
  zIndex: number;
}

const DECIMILLIPEDE_ENCOUNTER_X_OFFSET = -459;
const DECIMILLIPEDE_GAME_SCREEN_HEIGHT = 1080;
const DECIMILLIPEDE_SPINE_SCALE = 0.45;
// Source: bestiary_layout_decimillipede.tscn + decimillipede_elite.tscn slots.
// The segment scenes intentionally point at different skel_data resources than their filenames imply.
const DECIMILLIPEDE_VIEWPORT = {
  x: 420,
  y: 240,
  width: 1120,
  height: 620,
} as const;

function toBrowserSpineY(godotY: number): number {
  return DECIMILLIPEDE_GAME_SCREEN_HEIGHT - godotY;
}

function applyDecimillipedeTransform(player: SpinePlayer, part: DecimillipedePart) {
  player.skeleton.x = part.spineX;
  player.skeleton.y = part.spineY;
  player.skeleton.scaleX = DECIMILLIPEDE_SPINE_SCALE;
  player.skeleton.scaleY = DECIMILLIPEDE_SPINE_SCALE;
}

const DECIMILLIPEDE_PARTS: DecimillipedePart[] = [
  {
    id: "segment1-front-model",
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
    zIndex: 30,
  },
  {
    id: "segment2-middle-model",
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
    zIndex: 20,
  },
  {
    id: "segment3-back-model",
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
    zIndex: 10,
  },
];

export const DecimillipedeSpineStage = memo(function DecimillipedeSpineStage({
  fallbackImageUrl,
  monsterName,
  selectedMoveId,
  selectedMoveNonce = 0,
  className,
  imagePriority = true,
  showLoadingLabel = true,
  fallbackImageClassName,
}: DecimillipedeSpineStageProps) {
  const partRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const playerRefs = useRef<Record<string, SpinePlayer | null>>({});
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const selectedAnimation = useMemo(
    () => resolveDecimillipedeAnimation(selectedMoveId),
    [selectedMoveId],
  );

  useEffect(() => {
    let disposed = false;
    const createdPlayers: SpinePlayer[] = [];
    const mountedPartRefs = { ...partRefs.current };
    let readyCount = 0;
    setLoadState("loading");

    void import("@esotericsoftware/spine-player")
      .then(({ SpinePlayer: SpinePlayerCtor }) => {
        for (const part of DECIMILLIPEDE_PARTS) {
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
            success: (loadedPlayer) => {
              if (disposed) return;
              applyDecimillipedeTransform(loadedPlayer, part);
              playerRefs.current[part.id] = loadedPlayer;
              readyCount += 1;
              if (readyCount === DECIMILLIPEDE_PARTS.length) setLoadState("ready");
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
      for (const part of DECIMILLIPEDE_PARTS) mountedPartRefs[part.id]?.replaceChildren();
    };
  }, [monsterName]);

  useEffect(() => {
    if (loadState !== "ready") return;
    for (const part of DECIMILLIPEDE_PARTS) {
      const player = playerRefs.current[part.id];
      if (!player) continue;
      const animation = part.animationIds.includes(selectedAnimation) ? selectedAnimation : "idle_loop";
      const loop = animation === "idle_loop" || animation === "dead_loop";
      try {
        applyDecimillipedeTransform(player, part);
        player.animationState?.clearTrack(0);
        player.skeleton?.setToSetupPose();
        applyDecimillipedeTransform(player, part);
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
  }, [loadState, monsterName, selectedAnimation, selectedMoveNonce]);

  return (
    <div className={className}>
      {fallbackImageUrl && loadState !== "ready" && (
        <Image
          src={fallbackImageUrl}
          alt={monsterName}
          width={960}
          height={420}
          className={fallbackImageClassName ?? "absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"}
          priority={imagePriority}
        />
      )}
      <div
        className={`absolute inset-0 z-20 transition-opacity duration-300 ${loadState === "ready" ? "opacity-100" : "opacity-0"}`}
        aria-hidden={loadState !== "ready"}
      >
        {DECIMILLIPEDE_PARTS.map((part) => (
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
      {showLoadingLabel && loadState === "loading" && (
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

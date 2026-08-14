"use client";

import type { MutableRefObject } from "react";
import type { CodexCharacter, MonsterSpineAsset } from "@/lib/codex-types";
import {
  MonsterSpineStage,
  type MonsterStageFormAttachment,
  type MonsterStageFormPlacement,
  type MonsterStageVisualBounds,
} from "./monster-spine-stage";

export const CHARACTER_LOW_HEALTH_ANIMATION = "low_health_loop";
export const CHARACTER_LOW_HEALTH_HP_RATIO = 0.25;

export function characterHasLowHealthIdle(character: CodexCharacter): boolean {
  return Boolean(character.spineAsset?.animations.includes(CHARACTER_LOW_HEALTH_ANIMATION));
}

export function withCharacterLowHealthIdle(
  asset: MonsterSpineAsset | null | undefined,
  enabled: boolean,
): MonsterSpineAsset | null {
  if (!asset) return null;
  if (!enabled || !asset.animations.includes(CHARACTER_LOW_HEALTH_ANIMATION)) return asset;
  return {
    ...asset,
    idleAnimation: CHARACTER_LOW_HEALTH_ANIMATION,
    moveAnimations: {
      ...asset.moveAnimations,
      IDLE: [CHARACTER_LOW_HEALTH_ANIMATION],
    },
  };
}

export function characterLowHealthHp(maxHp: number): number {
  return Math.max(1, Math.floor(maxHp * CHARACTER_LOW_HEALTH_HP_RATIO));
}

const CHARACTER_STAGE_VIEWPORT_PADDING = {
  padLeft: "14%",
  padRight: "14%",
  padTop: "10%",
  padBottom: "0%",
} as const;

interface CharacterSpineStageProps {
  character: CodexCharacter;
  selectedMoveId?: string | null;
  selectedMoveNonce?: number;
  lowHealthIdle?: boolean;
  imagePriority?: boolean;
  className?: string;
  fallbackImageClassName?: string;
  formAttachment?: MonsterStageFormAttachment | null;
  formPlacementRef?: MutableRefObject<MonsterStageFormPlacement | null>;
  onVisualBoundsChange?: (bounds: MonsterStageVisualBounds | null) => void;
}

export function CharacterSpineStage({
  character,
  selectedMoveId = "IDLE",
  selectedMoveNonce,
  lowHealthIdle = false,
  imagePriority = false,
  className,
  fallbackImageClassName = "absolute inset-0 z-10 h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]",
  formAttachment = null,
  formPlacementRef,
  onVisualBoundsChange,
}: CharacterSpineStageProps) {
  return (
    <MonsterSpineStage
      asset={withCharacterLowHealthIdle(character.spineAsset, lowHealthIdle)}
      fallbackImageUrl={character.combatImageUrl}
      monsterName={character.name}
      selectedMoveId={selectedMoveId}
      selectedMoveNonce={selectedMoveNonce}
      imagePriority={imagePriority}
      showLoadingLabel={false}
      viewportTransitionTime={0}
      viewportPadding={CHARACTER_STAGE_VIEWPORT_PADDING}
      fallbackImageClassName={fallbackImageClassName}
      formAttachment={formAttachment}
      formPlacementRef={formPlacementRef}
      className={className}
      onVisualBoundsChange={onVisualBoundsChange}
    />
  );
}

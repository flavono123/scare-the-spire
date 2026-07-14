"use client";

import type { CodexCharacter } from "@/lib/codex-types";
import { MonsterSpineStage } from "./monster-spine-stage";

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
  imagePriority?: boolean;
  className?: string;
  fallbackImageClassName?: string;
}

export function CharacterSpineStage({
  character,
  selectedMoveId = "IDLE",
  selectedMoveNonce,
  imagePriority = false,
  className,
  fallbackImageClassName = "absolute inset-0 z-10 h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]",
}: CharacterSpineStageProps) {
  return (
    <MonsterSpineStage
      asset={character.spineAsset}
      fallbackImageUrl={character.combatImageUrl}
      monsterName={character.name}
      selectedMoveId={selectedMoveId}
      selectedMoveNonce={selectedMoveNonce}
      imagePriority={imagePriority}
      showLoadingLabel={false}
      viewportTransitionTime={0}
      viewportPadding={CHARACTER_STAGE_VIEWPORT_PADDING}
      fallbackImageClassName={fallbackImageClassName}
      className={className}
    />
  );
}

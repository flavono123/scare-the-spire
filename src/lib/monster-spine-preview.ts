import type { CodexMonster } from "./codex-types";

export function pickRandomMonsterPreviewMoveId(monster: CodexMonster): string | null {
  const playableMoves = monster.bestiaryMoves
    .filter((move) => move.id !== "NOTHING" && move.id !== "SPAWNED" && move.id !== "DEAD")
    .filter((move) => {
      const moveAnimations = monster.spineAsset?.moveAnimations[move.id] ?? [];
      const moveEffects = monster.spineAsset?.moveEffects[move.id] ?? [];
      return moveAnimations.length > 0 || moveEffects.some((effect) => effect.usable !== false);
    });
  const candidates: Array<string | null> = [null, ...playableMoves.map((move) => move.id)];
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

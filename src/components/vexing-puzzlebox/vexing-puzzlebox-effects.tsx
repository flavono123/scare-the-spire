"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { CharacterHandPointer } from "@/components/vexing-puzzlebox/character-hand-pointer";
import { MerchantFeedbackProvider } from "@/components/vexing-puzzlebox/merchant-feedback";
import { PuzzleboxAudioProvider } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { VakuuChatterProvider } from "@/components/vexing-puzzlebox/vakuu-chatter";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";

const subscribeNever = () => () => {};

/** Effects live in document.body, so they wait for hydration. */
export function VexingPuzzleboxEffects({
  gameCopy,
  children,
}: {
  gameCopy: VexingPuzzleboxGameCopy;
  children: ReactNode;
}) {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const merchantLines = useMemo(() => ({
    success: gameCopy.merchantSuccessLines,
    failure: gameCopy.merchantFailureLines,
    forbidden: gameCopy.merchantForbiddenLines,
    space: gameCopy.merchantSpaceLines,
  }), [gameCopy]);
  return (
    <PuzzleboxAudioProvider>
      <MerchantFeedbackProvider lines={merchantLines}>
        <VakuuChatterProvider name={gameCopy.vakuuName}>
          {children}
          {hydrated && <CharacterHandPointer />}
        </VakuuChatterProvider>
      </MerchantFeedbackProvider>
    </PuzzleboxAudioProvider>
  );
}

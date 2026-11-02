"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { CharacterHandPointer } from "@/components/vexing-puzzlebox/character-hand-pointer";
import { MerchantFeedbackProvider } from "@/components/vexing-puzzlebox/merchant-feedback";

const subscribeNever = () => () => {};

/** Effects live in document.body, so they wait for hydration. */
export function VexingPuzzleboxEffects({
  successLines,
  failureLines,
  children,
}: {
  successLines: string[];
  failureLines: string[];
  children: ReactNode;
}) {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  return (
    <MerchantFeedbackProvider successLines={successLines} failureLines={failureLines}>
      {children}
      {hydrated && <CharacterHandPointer />}
    </MerchantFeedbackProvider>
  );
}

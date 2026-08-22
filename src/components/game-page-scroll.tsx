"use client";

import type { ReactNode } from "react";
import { GameScrollArea } from "@/components/game-scroll-area";

/** Document-level vertical pane under the site navbar. */
export function GamePageScroll({ children }: { children: ReactNode }) {
  return (
    <GameScrollArea className="min-h-0 flex-1" size="large">
      {children}
    </GameScrollArea>
  );
}

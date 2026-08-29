"use client";

import type { ReactNode } from "react";

/**
 * @deprecated The document scrolls natively. Do not wrap page or index chrome.
 * Keep GameScrollArea for inner panes and modals only.
 */
export function GamePageScroll({ children }: { children: ReactNode }) {
  return children;
}

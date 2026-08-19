import catalog from "@/generated/history-course-catalog.json";
import type { CodexCard, CodexRelic } from "@/lib/codex-types";

/**
 * Cards + relics for History Course run playback.
 * Generated at lint/dev/build time from extracted STS2 data.
 * Import only from the client run-detail loader — do not load this
 * from a Worker/RSC request path.
 */
export function getHistoryCourseCatalog(): {
  allCards: CodexCard[];
  allRelics: CodexRelic[];
} {
  return {
    allCards: catalog.cards as CodexCard[],
    allRelics: catalog.relics as CodexRelic[],
  };
}

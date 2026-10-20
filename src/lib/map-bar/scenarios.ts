import type { MapBarInput } from "./types";

/** Named inputs for `/dev/map-bar?preset=<name>`, also pinned by scripts/map-bar.spec.ts. */
export const MAP_BAR_PRESETS: Record<string, MapBarInput> = {
  /**
   * The patch history of Untouchable (rework-untouchable): the start (an
   * ancient node, v0.98), three "?" that turned out a monster, a monster and a
   * chest (0.100.0, 0.102.0, 0.104.0), and the next version still "?". Which
   * outcome a patch gets is the shorts' call; the bar does not judge.
   * `orientation=vertical` turns it upright.
   */
  "untouchable-history": {
    nodes: [
      { type: "ancient" },
      { type: "unknown", outcome: "monster" },
      { type: "unknown", outcome: "monster" },
      { type: "unknown", outcome: "chest" },
      { type: "unknown" },
    ],
    character: "silent",
  },
};

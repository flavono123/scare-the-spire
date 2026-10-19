import type { CombatSimInput } from "./types";

/** Named inputs for `/dev/combat-sim?preset=<name>`, also pinned by scripts/combat-sim.spec.ts. */
export const COMBAT_SIM_PRESETS: Record<string, CombatSimInput> = {
  /**
   * v0.102.0 Doormaker in its Grasp phase: Grasp afflicts every card with
   * Weighted, so each play costs 1 more energy. Acrobatics (1) and Prepared+ (0)
   * take all 3 energy and leave a hand of Strikes that cannot be played.
   */
  "doormaker-grasp-0.102.0": {
    version: "0.102.0",
    character: "SILENT",
    encounter: "DOORMAKER_BOSS",
    energy: 3,
    maxEnergy: 3,
    hand: ["ACROBATICS", "PREPARED+"],
    drawPile: ["STRIKE_SILENT*6"],
    powers: { DOORMAKER: ["GRASP_POWER:1"] },
    moves: { DOORMAKER: "GRASP" },
    script: [
      { do: "wait", ms: 600 },
      { do: "play", card: "ACROBATICS" },
      { do: "play", card: "PREPARED+" },
      { do: "wait", ms: 800 },
    ],
  },
  /** v0.103.2 Axebots: two Axebots (front, back). Compare with `axebots-0.104.0`. */
  "axebots-0.103.2": {
    version: "0.103.2",
    character: "SILENT",
    encounter: "AXEBOTS_NORMAL",
    energy: 3,
    maxEnergy: 3,
    hand: ["STRIKE_SILENT", "STRIKE_SILENT", "DEFEND_SILENT", "DEFEND_SILENT", "NEUTRALIZE"],
    drawPile: ["STRIKE_SILENT*3", "DEFEND_SILENT*2"],
    script: [
      { do: "wait", ms: 600 },
      { do: "play", card: "STRIKE_SILENT", target: 0 },
      { do: "play", card: "DEFEND_SILENT" },
      { do: "wait", ms: 800 },
    ],
  },
  /** v0.104.0 Axebots: one Axebot (front). */
  "axebots-0.104.0": {
    version: "0.104.0",
    character: "SILENT",
    encounter: "AXEBOTS_NORMAL",
    energy: 3,
    maxEnergy: 3,
    hand: ["STRIKE_SILENT", "STRIKE_SILENT", "DEFEND_SILENT", "DEFEND_SILENT", "NEUTRALIZE"],
    drawPile: ["STRIKE_SILENT*3", "DEFEND_SILENT*2"],
    script: [
      { do: "wait", ms: 600 },
      { do: "play", card: "STRIKE_SILENT", target: 0 },
      { do: "play", card: "DEFEND_SILENT" },
      { do: "wait", ms: 800 },
    ],
  },
};

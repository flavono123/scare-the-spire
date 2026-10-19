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
      // The last discards fly for about a second after the game moves on.
      { do: "wait", ms: 1500 },
    ],
  },
  /**
   * v0.103.2 Axebots: two Axebots (front, back). Compare with `axebots-0.104.0`.
   * Encounter only: no character and no card interface are loaded or drawn.
   */
  "axebots-0.103.2": {
    version: "0.103.2",
    encounter: "AXEBOTS_NORMAL",
    script: [{ do: "wait", ms: 2000 }],
  },
  /** v0.104.0 Axebots: one Axebot (front). Encounter only. */
  "axebots-0.104.0": {
    version: "0.104.0",
    encounter: "AXEBOTS_NORMAL",
    script: [{ do: "wait", ms: 2000 }],
  },
};

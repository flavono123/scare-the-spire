import type { MonsterMoveGraph } from "@/lib/codex-types";
import type { ResolvedIntentGraph } from "./intentgraph-mod";

/**
 * Swap point for monster behavior graphs. Detail pages pick a renderer by `source`,
 * so a monster can move from the in-house STS2 state machine to an Intent Graph mod
 * layout without changing the page contract.
 */
export type MonsterIntentGraphView =
  | {
      /** State machine extracted by scripts/parse-monsters.py (current STS2 bestiary). */
      source: "state-machine";
      graph: MonsterMoveGraph;
    }
  | {
      /** Layout resolved from an Intent Graph mod `intents.json` entry for one ascension. */
      source: "intentgraph-mod";
      ascension: number;
      graph: ResolvedIntentGraph;
    };

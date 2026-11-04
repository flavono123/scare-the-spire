import type { MonsterBehaviorFactory } from "../monster";
import { createAwakenedOne } from "./awakened-one";
import { createBronzeOrb } from "./bronze-orb";
import { createHexaghost } from "./hexaghost";
import { createNemesis } from "./nemesis";
import { createTheCollector } from "./the-collector";
import { createTorchHead } from "./torch-head";

/** Monster classes with per-frame behavior, by the game's monster `ID`. */
export const MONSTER_BEHAVIORS: Record<string, MonsterBehaviorFactory> = {
  Hexaghost: createHexaghost,
  BronzeOrb: createBronzeOrb,
  TorchHead: createTorchHead,
  TheCollector: createTheCollector,
  AwakenedOne: createAwakenedOne,
  Nemesis: createNemesis,
};

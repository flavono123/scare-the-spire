import type {
  CodexCard,
  EncounterSceneCombatLayout,
  EncounterSceneCombatMonsterLayout,
  EncounterSceneMonsterSlot,
  MonsterSpineAsset,
} from "@/lib/codex-types";
import type { CombatSimInput, ScenePart, SimCatalog } from "@/lib/combat-sim/types";
import type { MonsterStaticArt } from "@/lib/monster-static-art";
import type { CombatSimViewOptions } from "./query-input";
import type { CardTrailAsset, EnergyGainVfx } from "./vfx-layer";

export interface EnergyCounterAsset {
  scene: string;
  size: number;
  layers: { name: string; url: string; rotationIndex: number | null }[];
  label: {
    fontColor: string;
    outlineColor: string;
    shadowColor: string;
    outlineSize: number;
    shadowOffset: [number, number];
    fontSize: number;
  };
}

export interface CombatSimMonsterView {
  id: string;
  name: string;
  spine: MonsterSpineAsset | null;
  staticArt: MonsterStaticArt | null;
  imageUrl: string | null;
  layout: EncounterSceneCombatMonsterLayout | null;
  /** Game-space feet position from the encounter scene slot, when the scene has one. */
  slotPosition: { x: number; y: number } | null;
}

export interface CombatSimView {
  input: CombatSimInput;
  preset: string | null;
  catalog: SimCatalog;
  warnings: string[];
  options: CombatSimViewOptions;
  cards: Record<string, CodexCard>;
  background: string | null;
  combatLayout: EncounterSceneCombatLayout | null;
  monsterSlots: EncounterSceneMonsterSlot[];
  /** Scene parts on the stage (the encounter is always there). */
  parts: ScenePart[];
  /** Null without a character (encounter-only scenes). */
  character: {
    id: string;
    name: string;
    spine: MonsterSpineAsset | null;
    imageUrl: string | null;
    energyCounter: EnergyCounterAsset | null;
  } | null;
  /** One entry per `catalog.encounter.monsters` entry, same order. */
  monsters: CombatSimMonsterView[];
  powerIcons: Record<string, string | null>;
  ui: Record<string, string>;
  /** card_trail_<character>.tscn values, drawn behind flying cards. */
  cardTrail: CardTrailAsset | null;
  /** <character>_energy_vfx_back/front.tscn glow and ring. */
  energyGainVfx: EnergyGainVfx | null;
}

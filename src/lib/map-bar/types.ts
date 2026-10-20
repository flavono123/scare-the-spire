/**
 * Input and output of the map progress bar simulator (/dev/map-bar): a row of
 * map nodes joined by path dots that a character marker walks along, made from
 * the history course's map parts. Nothing here judges an outcome good or bad;
 * the caller decides what each "?" reveals.
 */

export type MapBarNodeType = "ancient" | "unknown" | "monster" | "elite" | "shop" | "chest" | "rest";
export const MAP_BAR_NODE_TYPES: readonly MapBarNodeType[] = ["ancient", "unknown", "monster", "elite", "shop", "chest", "rest"];

/** What a "?" turns out to be. `unknown` arrives without revealing; `rest` is not a game reveal (synthetic). */
export type MapBarOutcome = "monster" | "elite" | "shop" | "chest" | "rest" | "event" | "unknown";
export const MAP_BAR_OUTCOMES: readonly MapBarOutcome[] = ["monster", "elite", "shop", "chest", "rest", "event", "unknown"];

export type MapBarOrientation = "horizontal" | "vertical";
export const MAP_BAR_ORIENTATIONS: readonly MapBarOrientation[] = ["horizontal", "vertical"];

export type MapBarAct = "overgrowth" | "underdocks" | "hive" | "glory";
export const MAP_BAR_ACTS: readonly MapBarAct[] = ["overgrowth", "underdocks", "hive", "glory"];

export type MapBarCharacter = "ironclad" | "silent" | "defect" | "necrobinder" | "regent";
export const MAP_BAR_CHARACTERS: readonly MapBarCharacter[] = ["ironclad", "silent", "defect", "necrobinder", "regent"];

export type MapBarBackground = "transparent" | "paper";

export interface MapBarNodeInput {
  type: MapBarNodeType;
  /** Only for `unknown` nodes: what the "?" shows once the marker arrives. */
  outcome?: MapBarOutcome;
  /** Transit into this node (ms); overrides `transitMs`. */
  transitMs?: number;
  /** Wait after this node's transit before the next one starts (ms); overrides `holdMs`. */
  holdMs?: number;
}

export interface MapBarInput {
  nodes: MapBarNodeInput[];
  /** horizontal: left to right. vertical: bottom to top, as the game map climbs. */
  orientation?: MapBarOrientation;
  /** Frame size in px (1:1 with the PNG). Defaults fit the nodes. */
  width?: number;
  height?: number;
  /**
   * Last node the marker reaches. Default: the last node that is not a "?"
   * without an outcome, so a trailing "?" stays ahead of the marker.
   */
  reach?: number;
  /**
   * Arrival time (ms) per node index: the marker pops on the node and a "?"
   * reveals at this time (transit progress 0.92). Index 0 is the start node
   * and is ignored; a missing entry follows the previous transit plus hold.
   */
  arrivals?: (number | null)[];
  /** Before the first transit (ms) when its arrival is not given. Default 500. */
  lead?: number;
  /** Transit length (ms). Default 2500, the history course's NODE_BASE_MS. */
  transitMs?: number;
  /** Wait between one transit's end and the next one's start (ms). Default 1000. */
  holdMs?: number;
  /** After the last transit (ms). Default `holdMs`. */
  tail?: number;
  /** Total length (ms); overrides `tail`. */
  duration?: number;
  /** Map scale: 0.6 is the history course's size (MAP_GAME_SCALE). */
  scale?: number;
  /** Ancient node size relative to the map's. Default 1. */
  ancientScale?: number;
  /** Ancient node art (`neow`, `orobas`, ...). Default neow. */
  ancient?: string;
  /** Icon set and path colors. Default overgrowth. */
  act?: MapBarAct;
  /** Marker; null draws none. Default silent. */
  character?: MapBarCharacter | null;
  /**
   * Extra size of a "?" while it reveals (1 + revealPulse * sin(pi * pop)).
   * The history course has no pulse; 0 turns it off. Default 0.3.
   */
  revealPulse?: number;
  /** Space before the first and after the last node along the bar (px). */
  padding?: number;
  /** Marker distance from its node's center, below (horizontal) or right (vertical), in px. */
  markerOffset?: number;
  /** transparent (default) or a flat paper panel in the act's map color. */
  background?: MapBarBackground;
}

export interface MapBarPoint {
  x: number;
  y: number;
}

export interface MapBarTick extends MapBarPoint {
  /** Radians. */
  rotation: number;
}

export interface MapBarNodeLayout {
  index: number;
  type: MapBarNodeType;
  outcome: MapBarOutcome | null;
  /** Node center in frame px. */
  x: number;
  y: number;
  /** Node box edge in frame px. */
  size: number;
  /** Where the marker stands on this node, frame px. */
  marker: MapBarPoint;
  /** The marker reaches this node. */
  reached: boolean;
  /** Reveals as a rest site, which the game's "?" never does. */
  synthetic: boolean;
}

export interface MapBarLayout {
  width: number;
  height: number;
  /** Frame px per history course px (scale / 0.6). */
  unit: number;
  nodes: MapBarNodeLayout[];
  /** Dots of edge i (node i to i + 1), from node i outward. */
  edges: MapBarTick[][];
}

export interface MapBarTransit {
  node: number;
  start: number;
  /** Marker pop and reveal: start + 0.92 duration. */
  arrive: number;
  end: number;
  duration: number;
}

export type MapBarEventKind = "start" | "depart" | "ring" | "arrive" | "reveal" | "settle";

export interface MapBarEvent {
  kind: MapBarEventKind;
  node: number;
  t: number;
  /** reveal: the icon the "?" turns into. */
  icon?: string;
  synthetic?: boolean;
}

export type MapBarNodeState = "inactive" | "active" | "current";

export type MapBarNodeArt =
  /** `key` picks the ancient node art (ANCIENT_ASSETS in the map parts). */
  | { kind: "ancient"; key: string }
  | { kind: "room"; icon: string; outline: string };

export interface MapBarNodeFrame {
  index: number;
  state: MapBarNodeState;
  art: MapBarNodeArt;
  /** "?" showing its outcome. */
  revealed: boolean;
  synthetic: boolean;
  /** Node scale by state (inactive 0.95, active 1, current 1.08) with the history course's 0.3 s ease. */
  scale: number;
  /** Extra scale of the icon while a "?" reveals (1 otherwise); the selection ring does not pulse. */
  pulse: number;
  /**
   * While the node is the transit's destination before the marker arrives
   * (no steady ring): the clockwise sweep, 0 during the trail and 0..1 over
   * 0.70..0.92. Null otherwise.
   */
  sweep: number | null;
}

export interface MapBarFrame {
  t: number;
  transit: { node: number; progress: number } | null;
  nodes: MapBarNodeFrame[];
  /** Per edge: how many of its dots are painted as traveled. */
  traveledTicks: number[];
  marker: { node: number; x: number; y: number; scale: number; opacity: number } | null;
  ring: { node: number; angle: number } | null;
}

/**
 * Pure engine of the map progress bar simulator: lays a row of map nodes out
 * along one axis and turns arrivals into a timeline, so `frameAt(t)` is the
 * same for the same input and time.
 *
 * Each transit into a node follows the history course's Phase 4 (SeededMapView,
 * `transitWindows`): the path dots paint over progress 0..0.70, the
 * destination ring sweeps clockwise over 0.70..0.92, and the marker pops on
 * the destination over 0.92..1.00. The destination becomes the selected node
 * when its transit starts (full opacity, no steady ring while it sweeps), and
 * node scales ease over 0.3 s (the node's CSS transition there: inactive 0.95,
 * active 1, current 1.08). One departure from the history course: a "?" shows
 * its outcome when the marker arrives (0.92), not when the transit starts.
 */

import {
  ANCIENT_CONTROL_SIZE,
  CHARACTER_MARKER_SIZE,
  MAP_GAME_SCALE,
  NORMAL_ICON_SIZE,
  TRANSIT_RING_END,
  TRANSIT_TRAIL_END,
  markerPopScale,
  pathTickPoints,
  transitWindows,
} from "@/lib/sts2-map-geometry";
import {
  mapIconNameForType,
  mapOutlineNameForType,
  revealedUnknownIconNameForRoom,
  revealedUnknownOutlineNameForRoom,
} from "@/lib/sts2-map-icons";
import { NODE_BASE_MS } from "@/lib/sts2-run-timeline";
import type { ReplayMapPointType } from "@/lib/sts2-run-replay";
import {
  MAP_BAR_ACTS,
  MAP_BAR_CHARACTERS,
  MAP_BAR_NODE_TYPES,
  MAP_BAR_ORIENTATIONS,
  MAP_BAR_OUTCOMES,
  type MapBarEvent,
  type MapBarFrame,
  type MapBarInput,
  type MapBarLayout,
  type MapBarNodeArt,
  type MapBarNodeFrame,
  type MapBarNodeInput,
  type MapBarNodeLayout,
  type MapBarNodeState,
  type MapBarOutcome,
  type MapBarTransit,
} from "./types";

const TRAIL_END = TRANSIT_TRAIL_END;
const RING_END = TRANSIT_RING_END;

/** Node scales by state and the node wrapper's `transition-transform duration-300` (CSS `ease`). */
const NODE_SCALE: Record<MapBarNodeState, number> = { inactive: 0.95, active: 1, current: 1.08 };
const SCALE_TRANSITION_MS = 300;

/** Bar spacing between node centers at the history course's size (px). */
const DEFAULT_SPACING = 160;

export const MAP_BAR_DEFAULTS = {
  orientation: "horizontal",
  lead: 500,
  transitMs: NODE_BASE_MS,
  holdMs: 1000,
  scale: MAP_GAME_SCALE,
  ancientScale: 1,
  ancient: "neow",
  act: "overgrowth",
  character: "silent",
  revealPulse: 0.3,
  background: "transparent",
} as const;

export interface MapBarTimeline {
  input: MapBarInput;
  layout: MapBarLayout;
  transits: MapBarTransit[];
  events: MapBarEvent[];
  duration: number;
  warnings: string[];
  frameAt(t: number): MapBarFrame;
}

// ---------------------------------------------------------------- validation

export function validateMapBarInput(input: MapBarInput): string[] {
  const errors: string[] = [];
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) errors.push("nodes가 비어 있습니다");
  (input.nodes ?? []).forEach((node, index) => {
    if (!MAP_BAR_NODE_TYPES.includes(node.type)) errors.push(`nodes[${index}].type: ${String(node.type)} (${MAP_BAR_NODE_TYPES.join(", ")})`);
    if (node.outcome !== undefined && !MAP_BAR_OUTCOMES.includes(node.outcome)) errors.push(`nodes[${index}].outcome: ${String(node.outcome)} (${MAP_BAR_OUTCOMES.join(", ")})`);
  });
  if (input.orientation !== undefined && !MAP_BAR_ORIENTATIONS.includes(input.orientation)) errors.push(`orientation: ${String(input.orientation)}`);
  if (input.act !== undefined && !MAP_BAR_ACTS.includes(input.act)) errors.push(`act: ${String(input.act)} (${MAP_BAR_ACTS.join(", ")})`);
  if (input.character !== undefined && input.character !== null && !MAP_BAR_CHARACTERS.includes(input.character)) errors.push(`character: ${String(input.character)} (${MAP_BAR_CHARACTERS.join(", ")}, none)`);
  for (const key of ["width", "height", "transitMs", "scale", "ancientScale"] as const) {
    const value = input[key];
    if (value !== undefined && !(Number.isFinite(value) && value > 0)) errors.push(`${key}: 0보다 큰 수여야 합니다`);
  }
  for (const key of ["lead", "holdMs", "tail", "duration", "revealPulse", "padding", "markerOffset"] as const) {
    const value = input[key];
    if (value !== undefined && !(Number.isFinite(value) && value >= 0)) errors.push(`${key}: 0 이상의 수여야 합니다`);
  }
  if (input.reach !== undefined && !(Number.isInteger(input.reach) && input.reach >= 0 && input.reach < (input.nodes?.length ?? 0))) {
    errors.push(`reach: 0..${(input.nodes?.length ?? 1) - 1} 범위의 정수여야 합니다`);
  }
  return errors;
}

/** Default reach: the last node that is not a "?" without an outcome. */
export function defaultReach(nodes: MapBarNodeInput[]): number {
  for (let index = nodes.length - 1; index > 0; index -= 1) {
    const node = nodes[index];
    if (node.type !== "unknown" || node.outcome !== undefined) return index;
  }
  return 0;
}

// ---------------------------------------------------------------- icons

const ROOM_TYPE: Record<Exclude<MapBarNodeInput["type"], "ancient">, ReplayMapPointType> = {
  unknown: "unknown",
  monster: "monster",
  elite: "elite",
  shop: "shop",
  chest: "treasure",
  rest: "rest_site",
};

/** Room type a revealed "?" maps to in the history course (`event` keeps the "?"). */
const REVEALED_ROOM: Record<Exclude<MapBarOutcome, "rest" | "unknown">, string> = {
  monster: "monster",
  elite: "elite",
  shop: "shop",
  chest: "treasure",
  event: "event",
};

/** A "?" reveals only for an outcome other than `unknown`. */
export function revealsOutcome(node: MapBarNodeInput): boolean {
  return node.type === "unknown" && node.outcome !== undefined && node.outcome !== "unknown";
}

export function isSynthetic(node: MapBarNodeInput): boolean {
  return node.type === "unknown" && node.outcome === "rest";
}

/** Art for a node, before or after its reveal. */
export function nodeArt(node: MapBarNodeInput, revealed: boolean, ancient: string): MapBarNodeArt {
  if (node.type === "ancient") return { kind: "ancient", key: ancient };
  if (node.type === "unknown" && revealed && node.outcome && node.outcome !== "unknown") {
    if (node.outcome === "rest") {
      // The game's "?" never reveals a rest site; this shows the rest site icon (synthetic).
      return { kind: "room", icon: mapIconNameForType("rest_site")!, outline: mapOutlineNameForType("rest_site")! };
    }
    const room = REVEALED_ROOM[node.outcome];
    return { kind: "room", icon: revealedUnknownIconNameForRoom(room), outline: revealedUnknownOutlineNameForRoom(room) };
  }
  const type = ROOM_TYPE[node.type];
  return { kind: "room", icon: mapIconNameForType(type)!, outline: mapOutlineNameForType(type)! };
}

// ---------------------------------------------------------------- layout

/** Node box edge in history course px (mapNodeSize: the visual box at MAP_GAME_SCALE). */
function siteNodeSize(node: MapBarNodeInput, ancientScale: number): number {
  return node.type === "ancient"
    ? Math.round(ANCIENT_CONTROL_SIZE * MAP_GAME_SCALE * ancientScale)
    : Math.round(NORMAL_ICON_SIZE * MAP_GAME_SCALE);
}

/** Selection ring overhang: the ring sits at inset -18%. */
const RING_EXTENT = 0.5 + 0.18;
/** The history course puts the marker 0.55 node sizes from the node's center. */
const MARKER_DISTANCE = 0.55;

export function buildMapBarLayout(input: MapBarInput): MapBarLayout {
  const orientation = input.orientation ?? MAP_BAR_DEFAULTS.orientation;
  const scale = input.scale ?? MAP_BAR_DEFAULTS.scale;
  const unit = scale / MAP_GAME_SCALE;
  const ancientScale = input.ancientScale ?? MAP_BAR_DEFAULTS.ancientScale;
  const nodes = input.nodes;
  const count = nodes.length;
  const sizes = nodes.map((node) => siteNodeSize(node, ancientScale) * unit);
  const markerSize = input.character === null ? 0 : CHARACTER_MARKER_SIZE * unit;
  const markerOffsets = sizes.map((size) => input.markerOffset ?? size * MARKER_DISTANCE);
  const roomSize = Math.round(NORMAL_ICON_SIZE * MAP_GAME_SCALE) * unit;

  const padding = input.padding ?? Math.ceil(RING_EXTENT * Math.max(sizes[0], sizes[count - 1]) + 8 * unit);
  const mainLength = orientation === "horizontal" ? input.width : input.height;
  const main = mainLength ?? Math.ceil(DEFAULT_SPACING * unit * Math.max(1, count - 1) + 2 * padding);
  // The node line sits so that the ring above and the marker below share the cross axis evenly.
  const ringHalf = RING_EXTENT * roomSize;
  const markerReach = markerSize > 0 ? (input.markerOffset ?? roomSize * MARKER_DISTANCE) + markerSize / 2 : ringHalf;
  const crossDefault = Math.ceil(ringHalf + markerReach + 24 * unit);
  const cross = (orientation === "horizontal" ? input.height : input.width) ?? crossDefault;
  const line = cross / 2 - (markerReach - ringHalf) / 2;

  const along = (index: number) => (count === 1 ? main / 2 : padding + (index * (main - 2 * padding)) / (count - 1));
  const reach = input.reach ?? defaultReach(nodes);
  const layoutNodes: MapBarNodeLayout[] = nodes.map((node, index) => {
    const a = along(index);
    const x = orientation === "horizontal" ? a : line;
    const y = orientation === "horizontal" ? line : main - a;
    return {
      index,
      type: node.type,
      outcome: node.outcome ?? null,
      x,
      y,
      size: sizes[index],
      marker: orientation === "horizontal" ? { x, y: y + markerOffsets[index] } : { x: x + markerOffsets[index], y },
      reached: index <= reach,
      synthetic: isSynthetic(node),
    };
  });

  // Path dots between node centers, in game units (frame px / scale), from the shared map geometry.
  const edges = layoutNodes.slice(0, -1).map((from, index) => {
    const to = layoutNodes[index + 1];
    return pathTickPoints(`map-bar:${index}`, { left: from.x / scale, top: from.y / scale }, { left: to.x / scale, top: to.y / scale })
      .map((point) => ({ x: point.left * scale, y: point.top * scale, rotation: point.rotation }));
  });

  return {
    width: orientation === "horizontal" ? main : cross,
    height: orientation === "horizontal" ? cross : main,
    unit,
    nodes: layoutNodes,
    edges,
  };
}

// ---------------------------------------------------------------- timing

/** CSS `ease` = cubic-bezier(0.25, 0.1, 0.25, 1). */
export function cssEase(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const [x1, y1, x2, y2] = [0.25, 0.1, 0.25, 1];
  const bezier = (p1: number, p2: number, s: number) => 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (bezier(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return bezier(y1, y2, (lo + hi) / 2);
}

interface ScaleChange {
  t: number;
  to: number;
}

/** A CSS transition retargeted at each change, starting from the value it had then. */
function easedValue(initial: number, changes: ScaleChange[], t: number): number {
  let segStart = 0;
  let segFrom = initial;
  let segTo = initial;
  const valueAt = (time: number) => segFrom + (segTo - segFrom) * cssEase((time - segStart) / SCALE_TRANSITION_MS);
  for (const change of changes) {
    if (change.t > t) break;
    const from = valueAt(change.t);
    if (change.to === segTo) continue;
    segStart = change.t;
    segFrom = from;
    segTo = change.to;
  }
  return valueAt(t);
}

export function buildMapBarTimeline(input: MapBarInput): MapBarTimeline {
  const errors = validateMapBarInput(input);
  if (errors.length > 0) throw new Error(errors.join("; "));
  const warnings: string[] = [];
  const nodes = input.nodes;
  const layout = buildMapBarLayout(input);
  const reach = input.reach ?? defaultReach(nodes);
  const transitDefault = input.transitMs ?? MAP_BAR_DEFAULTS.transitMs;
  const holdDefault = input.holdMs ?? MAP_BAR_DEFAULTS.holdMs;
  const ancient = input.ancient ?? MAP_BAR_DEFAULTS.ancient;
  const revealPulse = input.revealPulse ?? MAP_BAR_DEFAULTS.revealPulse;

  nodes.forEach((node, index) => {
    if (node.outcome !== undefined && node.type !== "unknown") warnings.push(`nodes[${index}]: outcome은 unknown 노드에만 씁니다 (${node.type}는 무시)`);
    if (isSynthetic(node)) warnings.push(`nodes[${index}]: 휴식 공개는 게임의 "?"에 없는 연출입니다 (synthetic)`);
    if (index > reach && node.outcome !== undefined) warnings.push(`nodes[${index}]: reach(${reach}) 뒤라 도착하지 않으므로 outcome이 보이지 않습니다`);
  });

  // Transits 1..reach: arrival at 0.92 of the transit.
  // A given arrival only has to leave room for the transit after the previous one ends;
  // without one, the transit starts after the lead or the previous hold.
  const transits: MapBarTransit[] = [];
  let previousEnd = 0;
  let free = input.lead ?? MAP_BAR_DEFAULTS.lead;
  for (let index = 1; index <= reach; index += 1) {
    let duration = nodes[index].transitMs ?? transitDefault;
    const given = input.arrivals?.[index];
    let start = free;
    if (typeof given === "number") {
      start = given - RING_END * duration;
      if (start < previousEnd) {
        const fitted = (given - previousEnd) / RING_END;
        if (fitted <= 0) throw new Error(`arrivals[${index}] (${given} ms)가 앞 노드의 이동이 끝나기(${Math.round(previousEnd)} ms) 전입니다`);
        warnings.push(`arrivals[${index}]: 앞 이동과 겹쳐서 이동을 ${Math.round(duration)} → ${Math.round(fitted)} ms로 줄였습니다`);
        duration = fitted;
        start = previousEnd;
      }
    }
    const transit = { node: index, start, arrive: start + RING_END * duration, end: start + duration, duration };
    transits.push(transit);
    previousEnd = transit.end;
    free = transit.end + (nodes[index].holdMs ?? holdDefault);
  }
  const lastEnd = transits.at(-1)?.end ?? (input.lead ?? MAP_BAR_DEFAULTS.lead);
  const duration = input.duration ?? lastEnd + (input.tail ?? holdDefault);

  const events: MapBarEvent[] = [{ kind: "start", node: 0, t: 0 }];
  for (const transit of transits) {
    const node = nodes[transit.node];
    events.push({ kind: "depart", node: transit.node, t: transit.start });
    if (node.type !== "ancient") events.push({ kind: "ring", node: transit.node, t: transit.start + TRAIL_END * transit.duration });
    events.push({ kind: "arrive", node: transit.node, t: transit.arrive });
    if (revealsOutcome(node)) {
      const art = nodeArt(node, true, ancient);
      events.push({ kind: "reveal", node: transit.node, t: transit.arrive, icon: art.kind === "room" ? art.icon : undefined, ...(isSynthetic(node) ? { synthetic: true } : {}) });
    }
    events.push({ kind: "settle", node: transit.node, t: transit.end });
  }
  events.sort((a, b) => a.t - b.t);

  // Scale targets per node over time.
  const scaleChanges: ScaleChange[][] = nodes.map((node, index) => {
    const changes: ScaleChange[] = [];
    const own = transits.find((transit) => transit.node === index);
    const next = transits.find((transit) => transit.node === index + 1);
    if (own) {
      const sweeps = node.type !== "ancient";
      changes.push({ t: own.start, to: sweeps ? NODE_SCALE.active : NODE_SCALE.current });
      if (sweeps) changes.push({ t: own.arrive, to: NODE_SCALE.current });
    }
    if (next) changes.push({ t: next.start, to: NODE_SCALE.active });
    return changes;
  });

  const frameAt = (rawT: number): MapBarFrame => {
    const t = Math.max(0, Math.min(rawT, duration));
    let latest: MapBarTransit | null = null;
    for (const transit of transits) if (transit.start <= t) latest = transit;
    const progress = latest ? Math.min(1, (t - latest.start) / latest.duration) : null;
    const inTransit = latest !== null && progress !== null && progress < 1;
    const dest = latest?.node ?? 0;
    const { trailFrac, ringFrac, charFrac } = transitWindows(progress ?? 1);

    const nodeFrames: MapBarNodeFrame[] = nodes.map((node, index) => {
      const own = transits.find((transit) => transit.node === index);
      const started = index === 0 || (own !== undefined && own.start <= t);
      const sweeping = index === dest && latest !== null && node.type !== "ancient" && ringFrac < 1;
      let state: MapBarNodeState;
      if (!started) state = "inactive";
      else if (index === dest) state = sweeping ? "active" : "current";
      else state = "active";
      const revealed = revealsOutcome(node) && own !== undefined && t >= own.arrive;
      const pulse = revealed && own !== undefined && t < own.end ? 1 + revealPulse * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - own.arrive) / (own.end - own.arrive)))) : 1;
      const initial = index === 0 ? NODE_SCALE.current : NODE_SCALE.inactive;
      return {
        index,
        state,
        art: nodeArt(node, revealed, ancient),
        revealed,
        synthetic: revealed && isSynthetic(node),
        scale: easedValue(initial, scaleChanges[index], t) * pulse,
        sweep: sweeping && ringFrac > 0 ? ringFrac : null,
      };
    });

    const traveledTicks = layout.edges.map((ticks, edge) => {
      const into = edge + 1;
      if (into > dest) return 0;
      if (into === dest && inTransit) {
        // Tick k (1..N) is painted once k / N <= the trail fraction.
        return Math.min(ticks.length, Math.floor(trailFrac * Math.max(1, ticks.length) + 1e-9));
      }
      return ticks.length;
    });

    let marker: MapBarFrame["marker"] = null;
    if (input.character !== null) {
      const popping = inTransit && charFrac > 0;
      const on = latest === null ? 0 : inTransit && charFrac === 0 ? dest - 1 : dest;
      const point = layout.nodes[on].marker;
      const scale = popping ? markerPopScale(charFrac) : 1;
      marker = { node: on, x: point.x, y: point.y, scale, opacity: popping ? charFrac : 1 };
    }

    const sweepNode = nodeFrames.find((frame) => frame.sweep !== null);
    return {
      t,
      transit: latest && inTransit ? { node: latest.node, progress: progress! } : null,
      nodes: nodeFrames,
      traveledTicks,
      marker,
      ring: sweepNode ? { node: sweepNode.index, angle: sweepNode.sweep! * 360 } : null,
    };
  };

  return { input, layout, transits, events, duration, warnings, frameAt };
}

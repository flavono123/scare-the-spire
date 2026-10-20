import { validateMapBarInput } from "@/lib/map-bar/engine";
import { MAP_BAR_PRESETS } from "@/lib/map-bar/scenarios";
import type { MapBarBackground, MapBarInput, MapBarNodeInput } from "@/lib/map-bar/types";

export type SearchParams = Record<string, string | string[] | undefined>;

export interface MapBarViewOptions {
  /** Start paused at this time (ms), or at the end. */
  t: number | "end" | null;
  autoplay: boolean;
}

export interface ParsedMapBarQuery {
  input: MapBarInput | null;
  preset: string | null;
  options: MapBarViewOptions;
  errors: string[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `ancient,unknown:monster,unknown` -> nodes. */
function parseNodes(value: string): MapBarNodeInput[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [type, outcome] = token.split(":");
      return outcome ? ({ type, outcome } as MapBarNodeInput) : ({ type } as MapBarNodeInput);
    });
}

/** `,1500,4000` -> [null, 1500, 4000]. */
function parseArrivals(value: string): (number | null)[] {
  return value.split(",").map((token) => (token.trim() === "" ? null : Number(token)));
}

const NUMBER_KEYS: [query: string, key: keyof MapBarInput][] = [
  ["width", "width"],
  ["height", "height"],
  ["reach", "reach"],
  ["lead", "lead"],
  ["transitMs", "transitMs"],
  ["transit", "transitMs"],
  ["holdMs", "holdMs"],
  ["hold", "holdMs"],
  ["tail", "tail"],
  ["duration", "duration"],
  ["scale", "scale"],
  ["ancientScale", "ancientScale"],
  ["revealPulse", "revealPulse"],
  ["pulse", "revealPulse"],
  ["padding", "padding"],
  ["markerOffset", "markerOffset"],
];

export function parseMapBarQuery(params: SearchParams): ParsedMapBarQuery {
  const errors: string[] = [];
  const get = (key: string) => first(params[key]);
  const preset = get("preset") ?? null;
  let input: Partial<MapBarInput> = {};

  if (preset) {
    const found = MAP_BAR_PRESETS[preset];
    if (found) input = structuredClone(found);
    else errors.push(`preset 없음: ${preset}`);
  }
  const json = get("json");
  if (json) {
    try {
      input = { ...input, ...(JSON.parse(json) as Partial<MapBarInput>) };
    } catch (error) {
      errors.push(`json 파싱 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const nodes = get("nodes");
  if (nodes !== undefined) input.nodes = parseNodes(nodes);
  const orientation = get("orientation");
  if (orientation !== undefined) input.orientation = orientation as MapBarInput["orientation"];
  const arrivals = get("arrivals");
  if (arrivals !== undefined) input.arrivals = parseArrivals(arrivals);
  for (const [query, key] of NUMBER_KEYS) {
    const value = get(query);
    if (value !== undefined && value !== "") (input as Record<string, unknown>)[key] = Number(value);
  }
  const ancient = get("ancient");
  if (ancient) input.ancient = ancient.toLowerCase();
  const act = get("act");
  if (act) input.act = act.toLowerCase() as MapBarInput["act"];
  const character = get("character");
  if (character !== undefined) input.character = character === "none" || character === "" ? null : (character.toLowerCase() as MapBarInput["character"]);
  const background = get("background");
  if (background !== undefined) input.background = background as MapBarBackground;
  if (input.background !== undefined && input.background !== "transparent" && input.background !== "paper") {
    errors.push(`background: ${String(input.background)} (transparent, paper)`);
  }

  const complete = Array.isArray(input.nodes) && input.nodes.length > 0;
  if (complete) errors.push(...validateMapBarInput(input as MapBarInput));
  else if (preset || json || nodes !== undefined) errors.push("nodes가 필요합니다 (예: nodes=ancient,unknown:monster,unknown)");

  const rawT = get("t");
  const options: MapBarViewOptions = {
    t: rawT === undefined ? null : rawT === "end" ? "end" : Math.max(0, Number(rawT) || 0),
    autoplay: get("autoplay") === "1",
  };
  return { input: complete && errors.length === 0 ? (input as MapBarInput) : null, preset, options, errors };
}

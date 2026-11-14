import { COMBAT_SIM_PRESETS } from "@/lib/combat-sim/scenarios";
import { SCENE_PARTS, SIM_SPEEDS, type CombatSimInput, type PileType, type PowerSpec, type ScenePart, type SimAction, type SimSpeed } from "@/lib/combat-sim/types";

export type SearchParams = Record<string, string | string[] | undefined>;

/** What the stage draws: everything, or one transparent layer for compositing. */
export type SimLayer = "all" | "scene" | "vfx" | "card";
export const SIM_LAYERS: readonly SimLayer[] = ["all", "scene", "vfx", "card"];

export interface CombatSimViewOptions {
  /** Start paused at this time (ms). `end` means the last frame. */
  t: number | "end" | null;
  autoplay: boolean;
  /** CSS width of the 1080x1920 stage; 360 at device scale 3 gives a 1080x1920 PNG. */
  frame: number;
  /** Show the in-frame unimplemented / rejected tags (not game UI, so off by default). */
  badges: boolean;
  /** Health bars (and the power row under them) on the creatures; `hp=0` hides them. */
  hpBars: boolean;
  /** Intent icons over the monsters; `intents=0` hides them. */
  intents: boolean;
  /** `card`: no hand, energy orb or piles, only the card being played with its glow and trail (`ui=card`). */
  ui: "full" | "card";
  /** Scene band in stage px: background height and creature feet y (`bgHeight=`, `feetY=`); null keeps the part defaults. */
  bgHeight: number | null;
  feetY: number | null;
  /** Visible stage height in px (`crop=`); null shows the full 1080x1920 stage. */
  crop: number | null;
  /** `layer=scene|vfx|card` draws that layer alone on a transparent stage; `all` is the default. */
  layer: SimLayer;
}

/**
 * `layout=shorts`: the scene for a title-less shorts window (1080x1050 band), no hand and no bars or
 * intents inside it. Each key can still be set after it.
 */
const SHORTS_LAYOUT = { ui: "card", hpBars: false, intents: false, bgHeight: 1050, feetY: 840, crop: 1050 } as const;

export interface ParsedCombatSimQuery {
  input: CombatSimInput | null;
  preset: string | null;
  options: CombatSimViewOptions;
  errors: string[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

/** A raw `+` in a query string decodes to a space; card ids have no spaces, so `PREPARED ` is `PREPARED+`. */
function cardList(value: string | undefined): string[] | undefined {
  return list(value?.replace(/ /g, "+"));
}

/** `DOORMAKER=GRASP_POWER:1,player=STRENGTH_POWER:2` */
function parsePowers(value: string): Record<string, PowerSpec[]> {
  const powers: Record<string, PowerSpec[]> = {};
  for (const entry of list(value) ?? []) {
    const [owner, spec] = entry.split("=");
    if (!owner || !spec) throw new Error(`powers entries look like OWNER=POWER[:amount]: ${entry}`);
    (powers[owner.trim()] ??= []).push(spec.trim());
  }
  return powers;
}

/** `BYRDONIS=33,1=20`: a number per monster id or index. */
function parseNumberMap(value: string, label: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const entry of list(value) ?? []) {
    const [monster, amount] = entry.split("=");
    if (!monster || amount === undefined || !Number.isFinite(Number(amount))) throw new Error(`${label} entries look like MONSTER=number: ${entry}`);
    map[monster.trim()] = Number(amount);
  }
  return map;
}

/** `DOORMAKER=GRASP` */
function parseMoves(value: string): Record<string, string> {
  const moves: Record<string, string> = {};
  for (const entry of list(value) ?? []) {
    const [monster, move] = entry.split("=");
    if (!monster || !move) throw new Error(`moves entries look like MONSTER=MOVE: ${entry}`);
    moves[monster.trim()] = move.trim().toUpperCase();
  }
  return moves;
}

/**
 * `wait:600,play:ACROBATICS,play:PREPARED+>STRIKE_SILENT|STRIKE_SILENT,play:STRIKE_SILENT@0,end,monsters,start,add:SHIV@hand`
 * `>` lists the cards to discard when the card asks; `@` is the target (or the pile for add).
 */
export function parseScript(value: string): SimAction[] {
  return (cardList(value) ?? []).map((token): SimAction => {
    const colon = token.indexOf(":");
    const verb = colon < 0 ? token : token.slice(0, colon);
    const rest = colon < 0 ? "" : token.slice(colon + 1);
    switch (verb.toLowerCase()) {
      case "wait":
        return { do: "wait", ms: Number(rest) };
      case "end":
      case "endturn":
        return { do: "endTurn" };
      case "monsters":
      case "monsterturn":
        return { do: "monsterTurn" };
      case "start":
      case "startturn":
        return { do: "startTurn" };
      case "add": {
        const [card, pile] = rest.split("@");
        return { do: "addCard", card, pile: (pile as PileType | undefined) ?? "hand" };
      }
      case "play": {
        const [head, choose] = rest.split(">");
        const [card, target] = head.split("@");
        const action: SimAction = { do: "play", card };
        if (target !== undefined) action.target = /^\d+$/.test(target) ? Number(target) : target;
        if (choose) action.choose = choose.split("|").filter(Boolean);
        return action;
      }
      default:
        throw new Error(`unknown script step: ${token}`);
    }
  });
}

export function parseCombatSimQuery(params: SearchParams): ParsedCombatSimQuery {
  const errors: string[] = [];
  const get = (key: string) => first(params[key]);
  const preset = get("preset") ?? null;
  let input: Partial<CombatSimInput> = {};

  if (preset) {
    const found = COMBAT_SIM_PRESETS[preset];
    if (found) input = structuredClone(found);
    else errors.push(`preset 없음: ${preset}`);
  }
  const json = get("json");
  if (json) {
    try {
      input = { ...input, ...(JSON.parse(json) as Partial<CombatSimInput>) };
    } catch (error) {
      errors.push(`json 파싱 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const version = get("version");
    if (version) input.version = version.replace(/^v/, "");
    const character = get("character");
    if (character) input.character = character.toUpperCase();
    const encounter = get("encounter");
    if (encounter) input.encounter = encounter.toUpperCase();
    const monsters = get("monsters");
    if (monsters !== undefined) input.monsters = (list(monsters) ?? []).map((id) => id.toUpperCase());
    const monsterHp = get("monsterHp");
    if (monsterHp !== undefined) input.monsterHp = parseNumberMap(monsterHp, "monsterHp");
    // parts=none (encounter only), parts=player, parts=player,cards
    const parts = get("parts");
    if (parts !== undefined) {
      const partList = parts === "none" ? [] : (list(parts) ?? []);
      const unknown = partList.filter((part) => !SCENE_PARTS.includes(part as ScenePart));
      if (unknown.length > 0) throw new Error(`알 수 없는 parts: ${unknown.join(", ")} (player, cards, none)`);
      input.parts = partList as ScenePart[];
    }
    const energy = get("energy");
    if (energy) {
      const [current, max] = energy.split("/");
      input.energy = Number(current);
      if (max !== undefined) input.maxEnergy = Number(max);
    }
    // Query or JSON; normal when neither gives one (the dev page fills it in).
    const speed = get("speed") ?? input.speed;
    if (speed !== undefined) {
      if (!SIM_SPEEDS.includes(speed as SimSpeed)) throw new Error(`알 수 없는 speed: ${speed} (normal, fast, instant)`);
      input.speed = speed as SimSpeed;
    }
    const maxEnergy = get("maxEnergy");
    if (maxEnergy) input.maxEnergy = Number(maxEnergy);
    // `hp=0` is a view option (hide the health bars): a player at 0 HP is not a scene this simulator plays.
    const hp = get("hp");
    if (hp && Number(hp) !== 0) input.hp = Number(hp);
    const piles = {
      hand: cardList(get("hand")),
      drawPile: cardList(get("draw") ?? get("drawPile")),
      discardPile: cardList(get("discard") ?? get("discardPile")),
      exhaustPile: cardList(get("exhaust") ?? get("exhaustPile")),
    };
    for (const [key, cards] of Object.entries(piles)) {
      if (cards) input[key as keyof typeof piles] = cards;
    }
    const powers = get("powers");
    if (powers !== undefined) input.powers = parsePowers(powers);
    const moves = get("moves");
    if (moves !== undefined) input.moves = parseMoves(moves);
    const seed = get("seed");
    if (seed) input.seed = Number(seed);
    const script = get("script");
    if (script !== undefined) input.script = parseScript(script);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const rawT = get("t");
  const t = rawT === undefined ? null : rawT === "end" ? "end" : Math.max(0, Number(rawT) || 0);
  const frame = Number(get("frame") ?? 360);
  const layout = get("layout");
  if (layout !== undefined && layout !== "shorts") errors.push(`알 수 없는 layout: ${layout} (shorts)`);
  const base = layout === "shorts" ? SHORTS_LAYOUT : null;
  const number = (key: string, fallback: number | null) => {
    const raw = get(key);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    errors.push(`${key}는 0보다 큰 숫자여야 합니다: ${raw}`);
    return fallback;
  };
  const ui = get("ui") ?? base?.ui ?? "full";
  if (ui !== "full" && ui !== "card") errors.push(`알 수 없는 ui: ${ui} (full, card)`);
  const layer = get("layer") ?? "all";
  if (!SIM_LAYERS.includes(layer as SimLayer)) errors.push(`알 수 없는 layer: ${layer} (${SIM_LAYERS.join(", ")})`);
  const options: CombatSimViewOptions = {
    t,
    autoplay: get("autoplay") === "1",
    frame: Number.isFinite(frame) && frame > 0 ? frame : 360,
    badges: get("badges") === "1",
    hpBars: get("hp") === undefined ? base?.hpBars ?? true : Number(get("hp")) !== 0,
    intents: get("intents") === undefined ? base?.intents ?? true : get("intents") !== "0",
    ui: ui === "card" ? "card" : "full",
    bgHeight: number("bgHeight", base?.bgHeight ?? null),
    feetY: number("feetY", base?.feetY ?? null),
    crop: number("crop", base?.crop ?? null),
    layer: SIM_LAYERS.includes(layer as SimLayer) ? (layer as SimLayer) : "all",
  };

  const complete = input.version && (input.encounter || input.monsters?.length);
  if (!complete && (preset || json || Object.keys(params).some((key) => ["version", "character", "encounter", "monsters", "parts"].includes(key)))) {
    errors.push("version과 encounter(또는 monsters)가 필요합니다 (player·cards 파트에는 character도)");
  }
  return { input: complete ? (input as CombatSimInput) : null, preset, options, errors };
}

import { COMBAT_SIM_PRESETS } from "@/lib/combat-sim/scenarios";
import type { CombatSimInput, PileType, PowerSpec, SimAction } from "@/lib/combat-sim/types";

export type SearchParams = Record<string, string | string[] | undefined>;

export interface CombatSimViewOptions {
  /** Start paused at this time (ms). `end` means the last frame. */
  t: number | "end" | null;
  autoplay: boolean;
  /** CSS width of the 1080x1920 stage; 360 at device scale 3 gives a 1080x1920 PNG. */
  frame: number;
  /** Show the in-frame unimplemented / rejected tags (not game UI, so off by default). */
  badges: boolean;
}

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
    const energy = get("energy");
    if (energy) {
      const [current, max] = energy.split("/");
      input.energy = Number(current);
      if (max !== undefined) input.maxEnergy = Number(max);
    }
    const maxEnergy = get("maxEnergy");
    if (maxEnergy) input.maxEnergy = Number(maxEnergy);
    const hp = get("hp");
    if (hp) input.hp = Number(hp);
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
  const options: CombatSimViewOptions = {
    t,
    autoplay: get("autoplay") === "1",
    frame: Number.isFinite(frame) && frame > 0 ? frame : 360,
    badges: get("badges") === "1",
  };

  const complete = input.version && input.character && input.encounter;
  if (!complete && (preset || json || Object.keys(params).some((key) => ["version", "character", "encounter"].includes(key)))) {
    errors.push("version, character, encounter가 모두 필요합니다");
  }
  return { input: complete ? (input as CombatSimInput) : null, preset, options, errors };
}

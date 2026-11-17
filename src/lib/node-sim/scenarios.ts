import { BLITZ_ENTRY_TYPES, parseEntryType, type BlitzAction, type BlitzEntryType, type BlitzMerchantInput } from "./blitz-merchant";
import type { GameLang } from "./loc-format";

/** Node types `/dev/node-sim?node=` knows. Add the next one here (see docs/NODE_SIM.md). */
export const NODE_TYPES = ["blitz_merchant"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

const snake = (type: string) => type.replace(/(?<!^)(?=[A-Z])/g, "_").toLowerCase();

/** One entry, shown the way a player meets it: room, open the inventory, hover that entry. */
function entryScene(type: BlitzEntryType): BlitzMerchantInput {
  return {
    node: "blitz_merchant",
    version: "0.113.0",
    locale: "kor",
    seed: 1,
    character: "IRONCLAD",
    act: "overgrowth",
    include: type,
    script: [
      { do: "wait", ms: 500 },
      { do: "open" },
      { do: "wait", ms: 300 },
      { do: "hover", entry: type },
      { do: "wait", ms: 2500 },
    ],
  };
}

/**
 * Named inputs for `/dev/node-sim?preset=<name>`: `blitz-merchant-<entry>` for each
 * BlitzMerchantEntryType (snake case, e.g. `blitz-merchant-card_enchant`), and
 * `blitz-merchant-browse`, one stock hovered slot by slot and one bought.
 */
export const NODE_SIM_PRESETS: Record<string, BlitzMerchantInput> = {
  ...Object.fromEntries(BLITZ_ENTRY_TYPES.map((type) => [`blitz-merchant-${snake(type)}`, entryScene(type)])),
  "blitz-merchant-browse": {
    node: "blitz_merchant",
    version: "0.113.0",
    locale: "kor",
    seed: 1,
    character: "IRONCLAD",
    act: "overgrowth",
    script: [
      { do: "wait", ms: 500 },
      { do: "open" },
      ...[1, 2, 3, 4, 5, 6].flatMap((slot): BlitzAction[] => [{ do: "hover", entry: String(slot) }, { do: "wait", ms: 1500 }]),
      { do: "buy", entry: "6" },
      { do: "wait", ms: 1500 },
    ],
  },
};

export type NodeSimQuery = Record<string, string | string[] | undefined>;

const one = (query: NodeSimQuery, key: string) => {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
};

/** `wait:600,open,hover:CardEnchant,unhover,buy:3,close`. */
export function parseScript(raw: string, errors: string[]): BlitzAction[] {
  return raw.split(",").map((token) => token.trim()).filter(Boolean).flatMap((token): BlitzAction[] => {
    const [verb, arg] = token.split(":");
    if (verb === "wait" && Number.isFinite(Number(arg))) return [{ do: "wait", ms: Number(arg) }];
    if (verb === "open" || verb === "close" || verb === "unhover") return [{ do: verb }];
    if ((verb === "hover" || verb === "buy") && arg) return [{ do: verb, entry: arg }];
    errors.push(`script: unknown action ${token}`);
    return [];
  });
}

/** Query keys override the preset and the JSON (`?json=`), like /dev/combat-sim. */
export function parseNodeSimQuery(query: NodeSimQuery): { input: BlitzMerchantInput; preset: string | null; errors: string[] } {
  const errors: string[] = [];
  const preset = one(query, "preset") ?? null;
  // Without a preset, `entry=X` starts from that entry's scene, anything else from the browse scene.
  const entryType = parseEntryType(one(query, "entry") ?? "");
  const base = preset ?? (entryType ? `blitz-merchant-${snake(entryType)}` : "blitz-merchant-browse");
  let input: BlitzMerchantInput = structuredClone(NODE_SIM_PRESETS[base] ?? NODE_SIM_PRESETS["blitz-merchant-browse"]);
  if (preset && !NODE_SIM_PRESETS[preset]) errors.push(`unknown preset ${preset}`);
  const json = one(query, "json");
  if (json) {
    try {
      input = { ...input, ...(JSON.parse(json) as Partial<BlitzMerchantInput>) };
    } catch (error) {
      errors.push(`json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const node = one(query, "node");
  if (node && !(NODE_TYPES as readonly string[]).includes(node)) errors.push(`node ${node} is not simulated (${NODE_TYPES.join(", ")})`);
  const set = <K extends keyof BlitzMerchantInput>(key: K, value: BlitzMerchantInput[K] | undefined) => {
    if (value !== undefined) input[key] = value;
  };
  set("version", one(query, "version"));
  const locale = one(query, "locale");
  if (locale && locale !== "kor" && locale !== "eng") errors.push(`locale must be kor or eng, got ${locale}`);
  else set("locale", locale as GameLang | undefined);
  const seed = one(query, "seed");
  if (seed !== undefined) {
    if (Number.isInteger(Number(seed))) input.seed = Number(seed);
    else errors.push(`seed must be an integer, got ${seed}`);
  }
  set("character", one(query, "character")?.toUpperCase());
  set("act", one(query, "act")?.toLowerCase());
  set("enchant", one(query, "enchant")?.toUpperCase());
  set("prismatic", one(query, "prismatic")?.toUpperCase());
  const entries = one(query, "entries");
  if (entries) {
    const parsed = entries.split(",").map((raw) => [raw, parseEntryType(raw)] as const);
    const bad = parsed.filter(([, type]) => !type).map(([raw]) => raw);
    if (bad.length) errors.push(`entries: unknown ${bad.join(", ")} (${BLITZ_ENTRY_TYPES.join(", ")})`);
    else {
      input.entries = parsed.map(([, type]) => type!);
      delete input.include;
    }
  }
  const include = one(query, "entry");
  if (include) {
    const type = parseEntryType(include);
    if (!type) errors.push(`entry: unknown ${include}`);
    else {
      input.include = type;
      delete input.entries;
    }
  }
  const open = one(query, "open");
  if (open !== undefined) input.startOpen = open === "1" || open === "true";
  const script = one(query, "script");
  if (script) input.script = parseScript(script, errors);
  return { input, preset, errors };
}

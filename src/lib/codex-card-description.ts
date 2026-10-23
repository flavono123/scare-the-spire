// Pure Codex description helpers (no React), shared by client components and
// server-rendered Compendium content.

import { bakeDescription } from "@/lib/codex-bake";
import type { CodexCard } from "@/lib/codex-types";

// =============================================================================
// Description parsing (BBCode -> structured parts)
// =============================================================================

export interface DescPart {
  type: "text" | "gold" | "newline" | "energy" | "upgrade" | "star" | "red" | "blue" | "purple";
  text: string;
}

export function cleanDescription(desc: string): string {
  let text = desc;
  // choose() with braces: {Var:choose(N):opt1|opt2} → first option
  text = text.replace(/\{[^}]*?choose\([^)]*\):([^|]*)\|[^}]*\}/g, "$1");
  // choose() without braces (residual): choose(N):text|rest} → first option
  text = text.replace(/choose\([^)]*\):([^|}]*)\|[^}]*\}/g, "$1");
  // choose() bare (no pipe): choose(N):text} or choose(N):text → strip entirely
  text = text.replace(/choose\([^)]*\):[^}]*\}?/g, "");
  // Remaining {Var} templates
  text = text.replace(/\{[^}]*\}/g, "");
  // [Tag] markers like [InCombat], [HasRider], etc.
  text = text.replace(/\[[A-Z][a-zA-Z]*\]/g, "");
  // Orphaned pipe-brace fragments like "번|{}번}" left from partial template stripping
  text = text.replace(/[^[\]]*\|\{?\}?[^[\]]*\}/g, "");
  return text;
}

export function parseDescription(rawDesc: string): DescPart[] {
  const desc = cleanDescription(rawDesc);
  const parts: DescPart[] = [];
  const regex = /\[gold\](.*?)\[\/gold\]|\[green\](.*?)\[\/green\]|\[red\](.*?)\[\/red\]|\[blue\](.*?)\[\/blue\]|\[purple\](.*?)\[\/purple\]|\[pink\](.*?)\[\/pink\]|\[energy:(\d+)\]|\[star:(\d+)\]|\[\/?\w+(?:[:=][^\]\s]+)?(?:\s+[^\]]*)?\]|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(desc)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: desc.slice(lastIndex, match.index) });
    }
    if (match[0] === "\n") {
      parts.push({ type: "newline", text: "" });
    } else if (match[1] !== undefined) {
      parts.push({ type: "gold", text: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: "upgrade", text: match[2] });
    } else if (match[3] !== undefined) {
      parts.push({ type: "red", text: match[3] });
    } else if (match[4] !== undefined) {
      parts.push({ type: "blue", text: match[4] });
    } else if (match[5] !== undefined) {
      parts.push({ type: "purple", text: match[5] });
    } else if (match[6] !== undefined) {
      parts.push({ type: "purple", text: match[6] }); // pink → purple alias
    } else if (match[7] !== undefined) {
      parts.push({ type: "energy", text: match[7] });
    } else if (match[8] !== undefined) {
      parts.push({ type: "star", text: match[8] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < desc.length) {
    parts.push({ type: "text", text: desc.slice(lastIndex) });
  }
  return parts;
}

// =============================================================================
// Card description renderer
//
// 게임 적용 순서: base → upgrade → enchant.
// 즉 강화는 base vars 위에 += diff 로 누적되고, 인챈트(damage/block)는
// 강화된 값 위에 추가로 적용된다 (Slay the Spire 2 EnchantmentModel: GetDamage()는
// base = upgrade-applied damage 에 EnchantDamageMultiplicative * EnchantDamageAdditive 적용).
//
// 변경 색상:
//  - 인챈트로 바뀐 값 → [purple]
//  - 강화로만 바뀐 값 (인챈트는 그 값을 안 건드림) → [green]
// =============================================================================

export interface EnchantVarMod {
  damageAdd?: number;
  damageMultiplier?: number;
  blockAdd?: number;
}

interface RenderCardOptions {
  upgrade?: boolean;
  upgradeLevel?: number;
  enchantMod?: EnchantVarMod | null;
}

function findVarKey(vars: Record<string, number>, name: string): string | undefined {
  return name in vars
    ? name
    : Object.keys(vars).find((k) => k.toLowerCase() === name.toLowerCase());
}

function getTemplateVarKeys(raw: string, vars: Record<string, number>): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const templateVarRe = /\{(\w+)(?=[:}])/g;
  let match: RegExpExecArray | null;

  while ((match = templateVarRe.exec(raw)) !== null) {
    const key = findVarKey(vars, match[1]);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }

  return keys;
}

function stripPowerSuffix(name: string): string {
  return name.toLowerCase().replace(/power$/, "");
}

function findUpgradeVarKey(
  vars: Record<string, number>,
  name: string,
  templateVarKeys: string[],
): string | undefined {
  const lowerName = name.toLowerCase();
  const exactTemplateKey = templateVarKeys.find((key) => key.toLowerCase() === lowerName);
  if (exactTemplateKey) return exactTemplateKey;

  const powerTemplateKey = templateVarKeys.find(
    (key) => stripPowerSuffix(key) === lowerName,
  );
  if (powerTemplateKey) return powerTemplateKey;

  return findVarKey(vars, name);
}

function findMatchingBrace(input: string, start: number): number {
  let depth = 0;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevelBranches(input: string): string[] {
  const branches: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "|" && depth === 0) {
      branches.push(input.slice(last, i));
      last = i + 1;
    }
  }
  branches.push(input.slice(last));
  return branches;
}

function isInsideBbTag(input: string, index: number): boolean {
  const tagRe = /\[\/?(gold|green|red|blue|purple|pink)(?::[^\]]*)?\]/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(input)) && match.index < index) {
    const tag = match[1];
    if (match[0].startsWith("[/")) {
      const openIndex = stack.lastIndexOf(tag);
      if (openIndex >= 0) stack.splice(openIndex, 1);
    } else {
      stack.push(tag);
    }
  }
  return stack.length > 0;
}

function wrapPlainUpgradeBranch(branch: string): string {
  if (!branch.trim() || /\[[^\]]+\]/.test(branch)) return branch;
  const match = branch.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return branch;
  const [, leading, body, trailing] = match;
  if (!body) return branch;
  return `${leading}[green]${body}[/green]${trailing}`;
}

function colorUpgradeOnlyBranches(input: string): string {
  const prefix = "IfUpgraded:show:";
  let out = "";
  let i = 0;

  while (i < input.length) {
    if (input[i] === "{" && input.startsWith(`{${prefix}`, i)) {
      const end = findMatchingBrace(input, i);
      if (end === -1) {
        out += input.slice(i);
        break;
      }
      const rest = input.slice(i + 1 + prefix.length, end);
      const branches = splitTopLevelBranches(rest);
      if (!isInsideBbTag(input, i)) {
        branches[0] = wrapPlainUpgradeBranch(branches[0] ?? "");
      }
      out += `{${prefix}${branches.join("|")}}`;
      i = end + 1;
      continue;
    }
    out += input[i];
    i++;
  }

  return out;
}

export function hasCardUpgrade(
  card: Pick<CodexCard, "upgrade" | "descriptionRaw" | "specialUpgrade">,
): boolean {
  return card.upgrade != null ||
    card.specialUpgrade != null ||
    /\{IfUpgraded:show:/.test(card.descriptionRaw ?? "");
}

export function getCardMaxUpgradeLevel(
  card: Pick<CodexCard, "upgrade" | "descriptionRaw" | "maxUpgradeLevel" | "specialUpgrade">,
): number {
  if (!hasCardUpgrade(card)) return 0;
  if (card.specialUpgrade) return Math.max(1, Math.floor(card.specialUpgrade.maxLevel || 1));
  return Math.max(1, Math.floor(card.maxUpgradeLevel || 1));
}

export function renderCardDescription(
  card: CodexCard,
  options: RenderCardOptions = {},
): string {
  const raw = card.descriptionRaw;
  if (!raw) return card.description;

  const upgradeLevel = Math.max(
    0,
    Math.floor(options.upgradeLevel ?? (options.upgrade ? 1 : 0)),
  );
  const finalVars: Record<string, number> = { ...card.vars };
  const upgradeChanged = new Set<string>();
  const enchantChanged = new Set<string>();
  const templateVarKeys = getTemplateVarKeys(raw, finalVars);

  const upgrade = card.upgrade ?? card.specialUpgrade?.upgrade ?? null;

  if (upgradeLevel > 0 && upgrade) {
    for (const [key, diff] of Object.entries(upgrade)) {
      if (typeof diff === "string" && /^[+-]\d+/.test(diff)) {
        const delta = parseInt(diff, 10) * upgradeLevel;
        const varKey = findUpgradeVarKey(finalVars, key, templateVarKeys);
        if (varKey && delta !== 0) {
          finalVars[varKey] = (finalVars[varKey] ?? 0) + delta;
          upgradeChanged.add(varKey.toLowerCase());
        }
      }
    }
  }

  const mod = options.enchantMod;
  if (mod) {
    for (const k of Object.keys(finalVars)) {
      const lk = k.toLowerCase();
      const before = finalVars[k];
      let after = before;
      if (lk.startsWith("damage")) {
        if (mod.damageMultiplier) after = Math.floor(after * mod.damageMultiplier);
        if (mod.damageAdd) after = after + mod.damageAdd;
      } else if (lk === "block" && mod.blockAdd) {
        after = after + mod.blockAdd;
      }
      if (after !== before) {
        finalVars[k] = after;
        enchantChanged.add(lk);
      }
    }
  }

  const varsForTemplate: Record<string, number | string> = {
    ...finalVars,
    IfUpgraded: upgradeLevel > 0 ? 1 : 0,
  };
  const coloredRaw = raw.replace(/\{(\w+)(?::diff\(\))?\}/g, (match, varName: string) => {
    const key = findVarKey(finalVars, varName);
    if (!key) return match;
    const val = String(finalVars[key]);
    const lk = key.toLowerCase();
    if (enchantChanged.has(lk)) return `[purple]${val}[/purple]`;
    if (upgradeChanged.has(lk)) return `[green]${val}[/green]`;
    return match;
  });

  return bakeDescription(
    upgradeLevel > 0 ? colorUpgradeOnlyBranches(coloredRaw) : coloredRaw,
    varsForTemplate,
  );
}

/**
 * Reads the numbers a monster's source computes from the ascension level and Dread
 * (`AscensionHelper.GetValueIfAscension`, `HasAscension`, `IsDread`) without running C#.
 *
 * It parses the monster class's int/decimal/float properties (expression-bodied, or a getter that is
 * `return x;` or `if (cond) return a; return b;`) and evaluates the expressions over a small grammar:
 * numbers, `+ - * /`, comparisons, `&& || !`, `cond ? a : b`, other properties of the same class, and the
 * three helpers. Anything else (state fields such as `_respawns`, other classes, loops) makes that value
 * unsupported (`null`); the caller then falls back to the site data.
 */

import type { SourceValues } from "./types";

/** `MegaCrit.Sts2.Core.Entities.Ascension.AscensionLevel`: a run at level N has every level up to N. */
const ASCENSION_LEVELS: Record<string, number> = {
  None: 0,
  SwarmingElites: 1,
  WearyTraveler: 2,
  Poverty: 3,
  TightBelt: 4,
  AscendersBane: 5,
  Inflation: 6,
  Scarcity: 7,
  ToughEnemies: 8,
  DeadlyEnemies: 9,
  DoubleBoss: 10,
};

export const TOUGH_ENEMIES = ASCENSION_LEVELS.ToughEnemies;
export const DEADLY_ENEMIES = ASCENSION_LEVELS.DeadlyEnemies;

class Unsupported extends Error {}

const MODIFIERS = "(?:public|private|protected|internal)\\s+(?:(?:override|static|virtual|readonly|sealed)\\s+)*";
const NUMERIC = "(?:int|decimal|float|double)";

/** `return x;` or `if (c) { return a; } return b;` as one expression, else null. */
function bodyAsExpression(body: string): string | null {
  const text = body.trim();
  const plain = text.match(/^return\s+([^;]+);$/);
  if (plain) return plain[1];
  const branch = text.match(/^if\s*\(([^]+?)\)\s*\{?\s*return\s+([^;]+);\s*\}?\s*return\s+([^;]+);$/);
  return branch ? `(${branch[1]}) ? (${branch[2]}) : (${branch[3]})` : null;
}

/** Numeric properties of a class source: name -> expression. */
export function parseNumericProperties(source: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const match of source.matchAll(new RegExp(`${MODIFIERS}${NUMERIC}\\s+(\\w+)\\s*=>\\s*([^;]+);`, "g"))) {
    props[match[1]] = match[2].trim();
  }
  for (const match of source.matchAll(new RegExp(`${MODIFIERS}${NUMERIC}\\s+(\\w+)\\s*\\{\\s*get\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}\\s*\\}`, "g"))) {
    const expression = bodyAsExpression(match[2]);
    if (expression && !(match[1] in props)) props[match[1]] = expression;
  }
  return props;
}

type Token = { kind: "num" | "id" | "op"; text: string };

function tokenize(expression: string): Token[] {
  const text = expression.replace(/\(\s*(?:int|decimal|float|double)\s*\)/g, "");
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?)[mfdMFD]?|([A-Za-z_][\w.]*)|(&&|\|\||==|!=|<=|>=|[-+*/<>!?:(),]))/y;
  let index = 0;
  while (index < text.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(text);
    if (!match) {
      if (/^\s*$/.test(text.slice(index))) break;
      throw new Unsupported(`token at ${index}: ${text.slice(index, index + 12)}`);
    }
    if (match[1] !== undefined) tokens.push({ kind: "num", text: match[1] });
    else if (match[2] !== undefined) tokens.push({ kind: "id", text: match[2] });
    else tokens.push({ kind: "op", text: match[3] });
    index = pattern.lastIndex;
  }
  return tokens;
}

type Value = number | boolean;

export function evaluateExpression(expression: string, props: Record<string, string>, values: SourceValues, seen: string[] = []): number | null {
  try {
    const result = run(expression, props, values, seen);
    return typeof result === "number" ? result : result ? 1 : 0;
  } catch (error) {
    if (error instanceof Unsupported) return null;
    throw error;
  }
}

function run(expression: string, props: Record<string, string>, values: SourceValues, seen: string[]): Value {
  const tokens = tokenize(expression);
  let at = 0;
  const peek = () => tokens[at];
  const take = (text?: string) => {
    const token = tokens[at];
    if (!token || (text !== undefined && token.text !== text)) throw new Unsupported(`expected ${text ?? "token"} in ${expression}`);
    at += 1;
    return token;
  };
  const num = (value: Value): number => (typeof value === "number" ? value : value ? 1 : 0);

  const ternary = (): Value => {
    const condition = or();
    if (peek()?.text !== "?") return condition;
    take("?");
    const yes = ternary();
    take(":");
    const no = ternary();
    return condition ? yes : no;
  };
  const or = (): Value => {
    let left = and();
    while (peek()?.text === "||") {
      take();
      const right = and();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  };
  const and = (): Value => {
    let left = equality();
    while (peek()?.text === "&&") {
      take();
      const right = equality();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  };
  const equality = (): Value => {
    let left = relation();
    while (peek()?.text === "==" || peek()?.text === "!=") {
      const op = take().text;
      const right = relation();
      left = op === "==" ? num(left) === num(right) : num(left) !== num(right);
    }
    return left;
  };
  const relation = (): Value => {
    let left = additive();
    while (["<", ">", "<=", ">="].includes(peek()?.text ?? "")) {
      const op = take().text;
      const right = num(additive());
      const l = num(left);
      left = op === "<" ? l < right : op === ">" ? l > right : op === "<=" ? l <= right : l >= right;
    }
    return left;
  };
  const additive = (): Value => {
    let left = multiplicative();
    while (peek()?.text === "+" || peek()?.text === "-") {
      const op = take().text;
      const right = num(multiplicative());
      left = op === "+" ? num(left) + right : num(left) - right;
    }
    return left;
  };
  const multiplicative = (): Value => {
    let left = unary();
    while (peek()?.text === "*" || peek()?.text === "/") {
      const op = take().text;
      const right = num(unary());
      left = op === "*" ? num(left) * right : num(left) / right;
    }
    return left;
  };
  const unary = (): Value => {
    if (peek()?.text === "!") {
      take();
      return !unary();
    }
    if (peek()?.text === "-") {
      take();
      return -num(unary());
    }
    return primary();
  };
  const args = (): Value[] => {
    take("(");
    const list: Value[] = [];
    if (peek()?.text !== ")") {
      list.push(ternary());
      while (peek()?.text === ",") {
        take();
        list.push(ternary());
      }
    }
    take(")");
    return list;
  };
  const primary = (): Value => {
    const token = peek();
    if (!token) throw new Unsupported(`unexpected end of ${expression}`);
    if (token.kind === "num") {
      take();
      return Number(token.text);
    }
    if (token.text === "(") {
      take();
      const inner = ternary();
      take(")");
      return inner;
    }
    if (token.kind !== "id") throw new Unsupported(`unexpected ${token.text}`);
    take();
    const name = token.text;
    if (name.startsWith("AscensionLevel.")) {
      const level = ASCENSION_LEVELS[name.slice("AscensionLevel.".length)];
      if (level === undefined) throw new Unsupported(name);
      return level;
    }
    if (name === "AscensionHelper.IsDread") {
      args();
      return values.dread;
    }
    if (name === "AscensionHelper.HasAscension") {
      const [level] = args();
      return values.ascension >= num(level);
    }
    if (name === "AscensionHelper.GetValueIfAscension") {
      const [level, ascended, fallback] = args();
      return values.ascension >= num(level) ? ascended : fallback;
    }
    const property = name.replace(/^(?:this|base)\./, "");
    if (peek()?.text !== "(" && property in props) {
      if (seen.includes(property)) throw new Unsupported(`cycle at ${property}`);
      return run(props[property], props, values, [...seen, property]);
    }
    throw new Unsupported(name);
  };

  const value = ternary();
  if (at !== tokens.length) throw new Unsupported(`trailing ${tokens[at].text} in ${expression}`);
  return value;
}

/** A property of the class at these values, or null when its expression is outside the grammar. */
export function evaluateProperty(props: Record<string, string>, name: string, values: SourceValues): number | null {
  return name in props ? evaluateExpression(props[name], props, values, [name]) : null;
}

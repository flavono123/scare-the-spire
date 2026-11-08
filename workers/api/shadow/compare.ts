/**
 * Shadow-read comparison (docs/supabase-exit/D1_SCHEMA_DESIGN.md 6): both answers are normalized the
 * same way and compared as values. JSON is compared parsed with keys sorted (rule 2); lists are
 * compared in order, as sets where Postgres has no ORDER BY, or as runs of equal sort keys where
 * Postgres orders without a tie-break (rule 1: a tie run is a set, the run at a LIMIT boundary is
 * compared by its size). Worker-safe, no imports.
 */

export type ListRule = {
  /** Dot path to the list: "" is the answer itself, "*" every value of an object, "[]" every element. */
  path: string;
  /** No ORDER BY in Postgres: compare as a multiset. */
  set?: boolean;
  /** Postgres sort keys without a tie-break (fields of each element); runs of equal keys are sets. */
  keys?: readonly string[];
  /** The query's LIMIT: a full list compares its last run by size only. */
  limit?: number;
};

export type CompareRules = {
  lists?: readonly ListRule[];
  /** Paths removed from both answers (e.g. the nav snapshot's fetchedAt). */
  ignore?: readonly string[];
};

export type DiffEntry = {
  path: string;
  supabase?: unknown;
  d1?: unknown;
  /** Members of a set or tie run found on one side only. */
  onlySupabase?: unknown[];
  onlyD1?: unknown[];
};

/** JSON text with object keys sorted at every level: equal values give equal text. */
export function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${canonical(item)}`);
  }
  return `{${parts.join(",")}}`;
}

function segmentsOf(path: string): string[] {
  return path === "" ? [] : path.split(".");
}

/** Applies `fn` to every node at `segments`, returning a new tree (the input is not changed). */
export function mapAt(value: unknown, segments: readonly string[], fn: (node: unknown) => unknown): unknown {
  if (segments.length === 0) return fn(value);
  const [head, ...rest] = segments;
  if (head === "[]") return Array.isArray(value) ? value.map((item) => mapAt(item, rest, fn)) : value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const object = value as Record<string, unknown>;
  if (head === "*") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(object)) out[key] = mapAt(item, rest, fn);
    return out;
  }
  if (!(head in object)) return value;
  return { ...object, [head]: mapAt(object[head], rest, fn) };
}

/** Removes `keys` from every object at `path`. */
export function dropKeys(value: unknown, path: string, keys: readonly string[]): unknown {
  return mapAt(value, segmentsOf(path), (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(node)) if (!keys.includes(key)) out[key] = item;
    return out;
  });
}

function removePath(value: unknown, path: string): unknown {
  const segments = segmentsOf(path);
  if (segments.length === 0) return undefined;
  const last = segments[segments.length - 1];
  return mapAt(value, segments.slice(0, -1), (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const { [last]: _removed, ...rest } = node as Record<string, unknown>;
    void _removed;
    return rest;
  });
}

type SetNode = { $set: string[] };
type GroupsNode = { $groups: Array<{ key: string; members?: string[]; size?: number }> };

function normalizeList(list: unknown, rule: ListRule): unknown {
  if (!Array.isArray(list)) return list;
  if (rule.set) return { $set: list.map(canonical).sort() } satisfies SetNode;
  if (!rule.keys) return list;
  const keys = rule.keys;
  const groups: GroupsNode["$groups"] = [];
  for (const item of list) {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const key = canonical(keys.map((name) => record[name]));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.members!.push(canonical(item));
    else groups.push({ key, members: [canonical(item)] });
  }
  for (const group of groups) group.members!.sort();
  if (rule.limit !== undefined && list.length >= rule.limit && groups.length > 0) {
    const last = groups[groups.length - 1];
    groups[groups.length - 1] = { key: last.key, size: last.members!.length };
  }
  return { $groups: groups } satisfies GroupsNode;
}

/** The comparable form of an answer: ignored paths removed, lists rewritten by their rules. */
export function normalizeAnswer(answer: unknown, rules: CompareRules): unknown {
  let value = answer;
  for (const path of rules.ignore ?? []) value = removePath(value, path);
  // Deeper lists first, so a list inside a list element is normalized before its parent.
  const lists = [...(rules.lists ?? [])].sort((a, b) => segmentsOf(b.path).length - segmentsOf(a.path).length);
  for (const rule of lists) value = mapAt(value, segmentsOf(rule.path), (node) => normalizeList(node, rule));
  return value;
}

const MAX_ENTRIES = 20;

function parsed(text: string): unknown {
  return JSON.parse(text);
}

function isSet(value: unknown): value is SetNode {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as SetNode).$set);
}

function isGroups(value: unknown): value is GroupsNode {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as GroupsNode).$groups);
}

function multisetDiff(a: readonly string[], b: readonly string[]): { onlyA: string[]; onlyB: string[] } {
  const counts = new Map<string, number>();
  for (const item of a) counts.set(item, (counts.get(item) ?? 0) + 1);
  const onlyB: string[] = [];
  for (const item of b) {
    const left = counts.get(item) ?? 0;
    if (left > 0) counts.set(item, left - 1);
    else onlyB.push(item);
  }
  const onlyA: string[] = [];
  for (const [item, left] of counts) for (let i = 0; i < left; i++) onlyA.push(item);
  return { onlyA, onlyB };
}

function diffInto(a: unknown, b: unknown, path: string, out: DiffEntry[]): void {
  if (out.length >= MAX_ENTRIES) return;
  if (canonical(a) === canonical(b)) return;
  if (isSet(a) && isSet(b)) {
    const { onlyA, onlyB } = multisetDiff(a.$set, b.$set);
    out.push({ path, onlySupabase: onlyA.map(parsed), onlyD1: onlyB.map(parsed) });
    return;
  }
  if (isGroups(a) && isGroups(b)) {
    const length = Math.max(a.$groups.length, b.$groups.length);
    for (let i = 0; i < length && out.length < MAX_ENTRIES; i++) {
      const left = a.$groups[i];
      const right = b.$groups[i];
      if (left && right && left.key === right.key && left.members && right.members) {
        const { onlyA, onlyB } = multisetDiff(left.members, right.members);
        if (onlyA.length || onlyB.length) out.push({ path: `${path}#${i}`, onlySupabase: onlyA.map(parsed), onlyD1: onlyB.map(parsed) });
        continue;
      }
      if (canonical(left) === canonical(right)) continue;
      out.push({
        path: `${path}#${i}`,
        onlySupabase: left ? (left.members ?? [`size ${left.size}`]).map((item) => (left.members ? parsed(item) : item)) : [],
        onlyD1: right ? (right.members ?? [`size ${right.size}`]).map((item) => (right.members ? parsed(item) : item)) : [],
      });
    }
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length && out.length < MAX_ENTRIES; i++) diffInto(a[i], b[i], `${path}[${i}]`, out);
    return;
  }
  const objectA = a && typeof a === "object" && !Array.isArray(a) && !isSet(a) && !isGroups(a);
  const objectB = b && typeof b === "object" && !Array.isArray(b) && !isSet(b) && !isGroups(b);
  if (objectA && objectB) {
    const recordA = a as Record<string, unknown>;
    const recordB = b as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(recordA), ...Object.keys(recordB)])].sort();
    for (const key of keys) {
      if (out.length >= MAX_ENTRIES) return;
      diffInto(recordA[key], recordB[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }
  out.push({ path, supabase: a === undefined ? "(missing)" : a, d1: b === undefined ? "(missing)" : b });
}

export type Comparison = { equal: boolean; entries: DiffEntry[] };

/** Compares two answers under `rules`; `entries` lists up to 20 differences. */
export function compareAnswers(supabase: unknown, d1: unknown, rules: CompareRules): Comparison {
  const left = normalizeAnswer(supabase, rules);
  const right = normalizeAnswer(d1, rules);
  if (canonical(left) === canonical(right)) return { equal: true, entries: [] };
  const entries: DiffEntry[] = [];
  diffInto(left, right, "", entries);
  return { equal: false, entries };
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;

function hasTimeWithin(value: unknown, from: number, to: number, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === "string") {
    if (!TIMESTAMP.test(value)) return false;
    const time = Date.parse(value);
    return !Number.isNaN(time) && time >= from && time <= to;
  }
  if (Array.isArray(value)) return value.some((item) => hasTimeWithin(item, from, to, depth + 1));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasTimeWithin(item, from, to, depth + 1));
  return false;
}

/** Rule 7: a differing row carries a time from the last `windowMs` (or a little ahead of now). */
export function differsOnRecentRows(entries: readonly DiffEntry[], now: number, windowMs: number): boolean {
  const from = now - windowMs;
  const to = now + 60_000;
  return entries.some((entry) =>
    hasTimeWithin(entry.supabase, from, to) ||
    hasTimeWithin(entry.d1, from, to) ||
    hasTimeWithin(entry.onlySupabase, from, to) ||
    hasTimeWithin(entry.onlyD1, from, to));
}

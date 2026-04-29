// SmartFormat-lite description baker.
//
// Replaces {Var} / {Var:fn(...)} / {Var:choose(...):a|b|...} templates from
// `description_raw` with concrete values from a `vars` map, producing the
// same baked-in form that cards already ship with. Handles balanced braces so
// SmartFormat self-refs like `{}` inside `choose()` branches survive.
// When a variable isn't in `vars`, the template is left intact so missing
// data is visible during ingest.

const REFERENCE_PLACEHOLDERS: Record<string, string> = {
  StarterCard: "시작 카드",
  AncientCard: "고대 카드",
  StarterRelic: "시작 유물",
  UpgradedRelic: "강화된 유물",
  Enchantment: "인챈트",
  EnchantmentName: "인챈트",
};

type VarValue = number | string;
type Vars = Record<string, VarValue>;

function looksLike(name: string, vars: Vars): VarValue | undefined {
  if (name in vars) return vars[name];
  const lower = name.toLowerCase();
  for (const k of Object.keys(vars)) {
    if (k.toLowerCase() === lower) return vars[k];
  }
  return undefined;
}

// Find the matching `}` for the `{` at `start` in `s`, ignoring nested pairs.
// Returns the index of the closing brace, or -1 if unbalanced.
function findMatchingBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Split branches on top-level `|` only (keeping `{...}` groups intact).
function splitBranches(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "|" && depth === 0) {
      out.push(s.slice(last, i));
      last = i + 1;
    }
  }
  out.push(s.slice(last));
  return out;
}

// Render a template body — i.e. the text between { and }.
// `body` is e.g. `Cards`, `Cards:diff()`, `Cards:choose(1):a|b`, or `` (self-ref `{}`).
function renderBody(body: string, vars: Vars, selfName: string | null): string {
  // Self-ref: `{}` resolves to the enclosing variable's value, or `X`
  // when the runtime stack count isn't known at the data layer.
  if (body === "" && selfName) {
    const v = looksLike(selfName, vars);
    return v !== undefined ? String(v) : "X";
  }

  // {Var.StringValue:cond:a|b} — `a` when Var is present and truthy. Without
  // a value, prefer the false branch — that's the generic phrasing the
  // game falls back to (e.g. "시작 카드를 고대의 형태로").
  const condMatch = body.match(/^(\w+)\.StringValue:cond:([\s\S]*)$/);
  if (condMatch) {
    const [, name, rest] = condMatch;
    const branches = splitBranches(rest);
    if (branches.length < 2) return `{${body}}`;
    const v = looksLike(name, vars);
    if (v === undefined) return renderTemplate(branches[1] ?? "", vars, name);
    return renderTemplate(v ? branches[0] : branches[1], vars, name);
  }

  // {Var:choose(N):a|b|...} — v==1 picks the first branch, else the last.
  // No value → first (singular) branch, mirroring the data-layer default
  // of "one stack" on PowerVar/CardsVar.
  const chooseMatch = body.match(/^(\w+):choose\(([^)]+)\):([\s\S]*)$/);
  if (chooseMatch) {
    const [, name, , rest] = chooseMatch;
    const opts = splitBranches(rest);
    const v = looksLike(name, vars);
    if (typeof v !== "number") {
      return renderTemplate(opts[0] ?? "", vars, name);
    }
    const idx = v === 1 ? 0 : opts.length - 1;
    return renderTemplate(opts[idx] ?? opts[0] ?? "", vars, name);
  }

  // {Var:plural:a|b} — singular for v==1, plural otherwise. No value →
  // singular.
  const pluralMatch = body.match(/^(\w+):plural:([\s\S]*)$/);
  if (pluralMatch) {
    const [, name, rest] = pluralMatch;
    const opts = splitBranches(rest);
    if (opts.length < 2) return `{${body}}`;
    const v = looksLike(name, vars);
    if (typeof v !== "number") return renderTemplate(opts[0], vars, name);
    return renderTemplate(v === 1 ? opts[0] : opts[1], vars, name);
  }

  // {Var:fn()} family
  const fnMatch = body.match(/^(\w+):(\w+)\(\)$/);
  if (fnMatch) {
    const [, name, fn] = fnMatch;
    const v = looksLike(name, vars);
    // No data-side base value → assume the var is a runtime stack/counter
    // (e.g. PowerVar.Amount). Show the conventional `X` placeholder.
    if (v === undefined) return "X";
    switch (fn) {
      case "energyIcons":
        return typeof v === "number" ? `[energy:${v}]` : "X";
      case "starIcons":
        return typeof v === "number" ? `[star:${v}]` : "X";
      case "percentMore":
        return typeof v === "number" ? `${v}%` : "X";
      case "diff":
        return String(v);
      default:
        return String(v);
    }
  }

  // {Var.StringValue} — bare reference to a StringVar (no :cond:).
  // Use the Korean placeholder if we have one; otherwise fall through to X.
  const stringValueMatch = body.match(/^(\w+)\.StringValue$/);
  if (stringValueMatch) {
    const [, name] = stringValueMatch;
    if (name in REFERENCE_PLACEHOLDERS) return REFERENCE_PLACEHOLDERS[name];
    return "X";
  }

  // {Var:a|b|...} — generic two-branch fallback for BoolVar / IntVar
  // shorthand (e.g. {OnPlayer:내 턴|대상의 턴}). Picks branch 0 when the
  // value is truthy or absent, branch 1 when falsy.
  const branchMatch = body.match(/^(\w+):([\s\S]*\|[\s\S]*)$/);
  if (branchMatch) {
    const [, name, rest] = branchMatch;
    const opts = splitBranches(rest);
    if (opts.length >= 2) {
      const v = looksLike(name, vars);
      if (v === undefined || v) return renderTemplate(opts[0], vars, name);
      return renderTemplate(opts[1], vars, name);
    }
  }

  // Bare {Var}
  if (/^\w+$/.test(body)) {
    const v = looksLike(body, vars);
    if (v !== undefined) return String(v);
    if (body in REFERENCE_PLACEHOLDERS) return REFERENCE_PLACEHOLDERS[body];
    // Unmatched bare var = runtime stack/counter (e.g. {Amount}). Render as X.
    return "X";
  }

  // Unknown shape — leave intact.
  return `{${body}}`;
}

// Walk the template, recursing into `{...}` blocks with brace awareness.
function renderTemplate(input: string, vars: Vars, selfName: string | null): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === "{") {
      const end = findMatchingBrace(input, i);
      if (end === -1) {
        out += input.slice(i);
        break;
      }
      const body = input.slice(i + 1, end);
      out += renderBody(body, vars, selfName);
      i = end + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

export function bakeDescription(raw: string, vars: Vars): string {
  if (!raw) return raw;
  return renderTemplate(raw, vars, null);
}

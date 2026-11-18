/**
 * The SmartFormat subset the Blitz merchant lines use (LocManager.LoadLocFormatters):
 * `{Var}`, `{Var:plural:a|b}`, `{Var:choose(1):a|b}`, `{Var:diff()}`; `{}` inside an option is the value.
 * Plural follows SmartFormat's rule for the culture: English picks the first word for 1, the
 * second otherwise; Korean ("ko") has one plural form, so it always takes the first word.
 */
export type GameLang = "kor" | "eng";

export type LocVars = Record<string, string | number>;

function pluralIndex(lang: GameLang, value: number): number {
  return lang === "kor" ? 0 : value === 1 ? 0 : 1;
}

/** Split on `|` that is not inside a nested `{...}`. */
function options(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (char === "|" && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

export function formatLoc(template: string, vars: LocVars, lang: GameLang): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const char = template[i];
    if (char !== "{") {
      out += char;
      i += 1;
      continue;
    }
    // Find the matching close brace.
    let depth = 0;
    let end = i;
    for (; end < template.length; end += 1) {
      if (template[end] === "{") depth += 1;
      if (template[end] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = template.slice(i + 1, end);
    i = end + 1;
    const colon = body.indexOf(":");
    const name = colon < 0 ? body : body.slice(0, colon);
    if (!(name in vars)) throw new Error(`loc: no value for {${name}} in ${JSON.stringify(template)}`);
    const value = vars[name];
    if (colon < 0) {
      out += String(value);
      continue;
    }
    const rest = body.slice(colon + 1);
    const fill = (option: string) => formatLoc(option.replaceAll("{}", String(value)), vars, lang);
    if (rest.startsWith("plural:")) {
      const words = options(rest.slice("plural:".length));
      out += fill(words[Math.min(pluralIndex(lang, Number(value)), words.length - 1)]);
    } else if (rest.startsWith("plural(")) {
      // {Var:plural(ru):a|b|c}: the named culture's CLDR plural categories, in CLDR order.
      const close = rest.indexOf("):");
      const rules = new Intl.PluralRules(rest.slice("plural(".length, close));
      const categories = rules.resolvedOptions().pluralCategories as string[];
      const order = ["zero", "one", "two", "few", "many", "other"].filter((category) => categories.includes(category));
      const words = options(rest.slice(close + 2));
      out += fill(words[Math.min(order.indexOf(rules.select(Number(value))), words.length - 1)]);
    } else if (rest.startsWith("choose(")) {
      const close = rest.indexOf("):");
      const choices = rest.slice("choose(".length, close).split(",");
      const words = options(rest.slice(close + 2));
      const at = choices.indexOf(String(value));
      out += fill(words[at >= 0 ? at : words.length - 1]);
    } else if (rest.startsWith("diff(")) {
      // HighlightDifferencesFormatter: a canonical value has no difference to highlight.
      out += String(value);
    } else {
      throw new Error(`loc: formatter not ported: {${body}}`);
    }
  }
  return out;
}

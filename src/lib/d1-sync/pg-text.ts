/**
 * Postgres text forms the first copy reads from `pg_dump --data-only` (COPY text format) and turns
 * into row images (design 5.2). Worker-safe: no imports, no Node APIs.
 */

/** One COPY data line (without its newline) -> field values, null for \N. */
export function parseCopyLine(line: string): Array<string | null> {
  const out: Array<string | null> = [];
  for (const field of line.split("\t")) {
    out.push(field === "\\N" ? null : unescapeCopyField(field));
  }
  return out;
}

const SIMPLE_ESCAPES: Record<string, string> = {
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  "\\": "\\",
};

function unescapeCopyField(field: string): string {
  if (!field.includes("\\")) return field;
  let out = "";
  for (let i = 0; i < field.length; i++) {
    const ch = field[i];
    if (ch !== "\\" || i + 1 >= field.length) {
      out += ch;
      continue;
    }
    const next = field[i + 1];
    if (next in SIMPLE_ESCAPES) {
      out += SIMPLE_ESCAPES[next];
      i += 1;
    } else if (next >= "0" && next <= "7") {
      let digits = next;
      while (digits.length < 3 && field[i + 1 + digits.length] >= "0" && field[i + 1 + digits.length] <= "7") {
        digits += field[i + 1 + digits.length];
      }
      out += String.fromCharCode(parseInt(digits, 8));
      i += digits.length;
    } else if (next === "x" && /^[0-9a-fA-F]/.test(field[i + 2] ?? "")) {
      const digits = /^[0-9a-fA-F]{1,2}/.exec(field.slice(i + 2))![0];
      out += String.fromCharCode(parseInt(digits, 16));
      i += 1 + digits.length;
    } else {
      // Any other escaped character stands for itself.
      out += next;
      i += 1;
    }
  }
  return out;
}

/**
 * A one-dimensional Postgres array literal ('{a,"b c",NULL}') -> its elements, null for an unquoted
 * NULL. Throws on any other shape (the copied tables only hold one-dimensional text[] and int[]).
 */
export function parsePgArray(text: string): Array<string | null> {
  if (text.length < 2 || text[0] !== "{" || text[text.length - 1] !== "}") {
    throw new Error(`not an array literal: ${text.slice(0, 40)}`);
  }
  const body = text.slice(1, -1);
  const out: Array<string | null> = [];
  if (body === "") return out;
  let i = 0;
  while (i <= body.length) {
    if (body[i] === "{") throw new Error("multi-dimensional arrays are not supported");
    if (body[i] === '"') {
      let value = "";
      i += 1;
      while (i < body.length && body[i] !== '"') {
        if (body[i] === "\\") i += 1;
        value += body[i] ?? "";
        i += 1;
      }
      if (body[i] !== '"') throw new Error("unterminated quoted array element");
      i += 1;
      out.push(value);
    } else {
      let end = body.indexOf(",", i);
      if (end === -1) end = body.length;
      const raw = body.slice(i, end).trim();
      if (raw === "") throw new Error("empty unquoted array element");
      out.push(raw.toUpperCase() === "NULL" ? null : raw);
      i = end;
    }
    if (i >= body.length) break;
    if (body[i] !== ",") throw new Error("expected ',' between array elements");
    i += 1;
  }
  return out;
}

/**
 * Plain D1 statements: `{ sql, params }` with ?1..?N placeholders, usable as
 * `db.prepare(sql).bind(...params)` in the Worker and convertible to SQL text for
 * `wrangler d1 execute --file`. Worker-safe: no imports.
 */

export type D1Value = string | number | null;

export interface D1Statement {
  sql: string;
  params: D1Value[];
  /**
   * What 0 changed rows means for this statement (design 5.3 items 8 and 9): 'zero_rows' for a
   * partial U whose row is missing (re-read Supabase), 'orphan' for a 조각모음 body without its post.
   * Unset: 0 rows is a normal outcome (a delete of a missing row, an idempotent re-apply).
   */
  zeroRows?: "zero_rows" | "orphan";
}

export function sqlLiteral(value: D1Value): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The statement as one SQL text with its parameters inlined. Placeholders inside quoted literals or
 * identifiers of the statement are left alone. Note D1's 100 KB limit on SQL text: a large bound
 * value (a run raw) can exceed it as a literal, so such rows are better applied with bind().
 */
export function toSqlText(statement: D1Statement): string {
  const { sql, params } = statement;
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "?") {
      const match = /^\d+/.exec(sql.slice(i + 1));
      if (!match) throw new Error("only numbered ?N placeholders are supported");
      const index = Number(match[0]) - 1;
      if (index < 0 || index >= params.length) throw new Error(`placeholder ?${match[0]} has no value`);
      out += sqlLiteral(params[index]);
      i += match[0].length;
      continue;
    }
    out += ch;
  }
  const trimmed = out.trim();
  return trimmed.endsWith(";") ? trimmed : `${trimmed};`;
}

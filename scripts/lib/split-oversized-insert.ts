/**
 * `wrangler d1 export` writes each row as one literal INSERT, but D1 (local too) refuses a statement
 * over 100,000 bytes (SQLITE_TOOBIG). Rows written with bound parameters can be larger (a 역사 강의서
 * run's raw file is ~290 KB), so their exported INSERT cannot be imported back. This rewrites such an
 * INSERT into an INSERT with the largest value emptied, then UPDATEs that append it in chunks.
 */

/** D1's maximum SQL statement length in bytes. */
export const D1_MAX_STATEMENT_BYTES = 100_000;

const INSERT_RE = /^INSERT INTO ("(?:[^"]|"")*"|[A-Za-z_][\w]*) \((.*?)\) VALUES\((.*)\);$/s;
// A quoted literal, optionally wrapped in the replace(...,'\n',char(10)) calls the export uses for
// control characters. Captures: the replace( prefix, the literal body, the ,'\x',char(N)) suffix.
const VALUE_RE = /^((?:replace\()*)'((?:[^']|'')*)'((?:,'\\[a-z]',char\(\d+\)\))*)$/s;

const byteLength = (text: string) => Buffer.byteLength(text, "utf8");

/** Top-level comma split that respects '...' literals, "..." identifiers and parentheses. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) {
        if (text[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Literal-body chunks of at most maxBytes, never splitting a '' escape or a \x sequence. */
function chunkBody(body: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < body.length) {
    let end = Math.min(body.length, start + maxBytes);
    while (byteLength(body.slice(start, end)) > maxBytes) end = start + Math.floor((end - start) * 0.9);
    if (end < body.length) {
      // Back off while the cut would leave a lone quote or a trailing backslash.
      while (end > start + 1 && (body[end - 1] === "\\" || body[end - 1] === "'" || body[end] === "'")) end -= 1;
      if (end <= start + 1) throw new Error("cannot find a safe chunk boundary");
    }
    chunks.push(body.slice(start, end));
    start = end;
  }
  return chunks;
}

/** Statements equivalent to `statement`, each at most maxBytes; the statement itself when it fits. */
export function splitOversizedInsert(statement: string, maxBytes = D1_MAX_STATEMENT_BYTES): string[] {
  if (byteLength(statement) <= maxBytes) return [statement];
  const insert = INSERT_RE.exec(statement);
  if (!insert) throw new Error(`oversized statement is not a single-row INSERT: ${statement.slice(0, 80)}`);
  const [, table, columnList, valueList] = insert;
  const columns = splitTopLevel(columnList);
  const values = splitTopLevel(valueList);
  if (columns.length !== values.length) throw new Error(`column and value counts differ in ${table}`);

  const big = values.reduce((best, value, index) => (value.length > values[best].length ? index : best), 0);
  const parsed = VALUE_RE.exec(values[big]);
  if (!parsed) throw new Error(`the largest value of ${table}.${columns[big]} is not a text literal`);
  const [, prefix, body, suffix] = parsed;

  const where = columns
    .map((column, index) => (index === big ? null : `${column} IS ${values[index]}`))
    .filter(Boolean)
    .join(" AND ");
  if (!where) throw new Error(`${table} has no other column to find the row by`);
  const head = `UPDATE ${table} SET ${columns[big]} = ${columns[big]} || ${prefix}'`;
  const tail = `'${suffix} WHERE ${where};`;
  const budget = maxBytes - byteLength(head) - byteLength(tail);
  if (budget < 1000) throw new Error(`${table}: the other values leave no room for a chunk`);

  const emptied = values.map((value, index) => (index === big ? "''" : value));
  return [
    `INSERT INTO ${table} (${columnList}) VALUES(${emptied.join(",")});`,
    ...chunkBody(body, budget).map((chunk) => `${head}${chunk}${tail}`),
  ];
}

/** The export text with every oversized INSERT line split; `split` counts the rewritten rows. */
export function splitOversizedInserts(sql: string, maxBytes = D1_MAX_STATEMENT_BYTES): { sql: string; split: number } {
  let split = 0;
  const lines = sql.split("\n").flatMap((line) => {
    const statements = splitOversizedInsert(line, maxBytes);
    if (statements.length > 1) split += 1;
    return statements;
  });
  return { sql: lines.join("\n"), split };
}

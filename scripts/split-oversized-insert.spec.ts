import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { splitOversizedInsert, splitOversizedInserts } from "./lib/split-oversized-insert";

// node:sqlite (Node 22.5+) has no types in this @types/node.
type SqliteDb = { exec(sql: string): void; prepare(sql: string): { get(): unknown } };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => SqliteDb };

// A small limit stands in for D1's 100,000 bytes.
const LIMIT = 2_000;
const text = Array.from({ length: 400 }, (_, index) => `line ${index} it's "quoted" \\ 한글 ${"x".repeat(index % 7)}`).join("\n");
// The export's form: single quotes doubled, newlines as \n inside replace(..., '\n', char(10)).
const literal = `replace('${text.replace(/'/g, "''").replace(/\n/g, "\\n")}','\\n',char(10))`;
const statement = `INSERT INTO "post_file" ("service","post_id","raw") VALUES('history_course','abc',${literal});`;
assert.ok(Buffer.byteLength(statement) > LIMIT);

const statements = splitOversizedInsert(statement, LIMIT);
assert.ok(statements.length > 2);
for (const each of statements) assert.ok(Buffer.byteLength(each) <= LIMIT, `${Buffer.byteLength(each)} bytes`);

function rawAfter(sql: string[]): string {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE "post_file" ("service" TEXT, "post_id" TEXT, "raw" TEXT NOT NULL, PRIMARY KEY ("service","post_id"))`);
  db.exec(`INSERT INTO "post_file" VALUES ('history_course','other','keep')`);
  for (const each of sql) db.exec(each);
  const row = db.prepare(`SELECT raw FROM "post_file" WHERE post_id = 'abc'`).get() as { raw: string };
  const other = db.prepare(`SELECT raw FROM "post_file" WHERE post_id = 'other'`).get() as { raw: string };
  assert.equal(other.raw, "keep");
  return row.raw;
}

// The split statements rebuild exactly what the original INSERT stores.
assert.equal(rawAfter(statements), text);
assert.equal(rawAfter([statement]), text);

// Short lines pass through untouched; the file-level helper counts rewritten rows.
const file = `CREATE TABLE t (a TEXT);\n${statement}\nINSERT INTO "t" ("a") VALUES('short');`;
const result = splitOversizedInserts(file, LIMIT);
assert.equal(result.split, 1);
assert.ok(result.sql.startsWith("CREATE TABLE t (a TEXT);\n"));
assert.ok(result.sql.endsWith(`INSERT INTO "t" ("a") VALUES('short');`));

// Anything else that is too long fails loudly instead of importing something different.
assert.throws(() => splitOversizedInsert(`SELECT '${"x".repeat(LIMIT)}';`, LIMIT), /not a single-row INSERT/);

console.log("split-oversized-insert.spec.ts ok");

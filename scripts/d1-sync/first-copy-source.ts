/**
 * Sources of the first copy (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.2 steps 2, 3 and 7): W0 =
 * max(id) of public.d1_change_log read just before the dump, a `pg_dump --data-only` of the copied
 * tables from one snapshot, and L0 by the 5-minute rule.
 *
 * - PoolerSource: the live Supabase project through the session pooler (psql + pg_dump from libpq;
 *   the password goes to the child processes through PGPASSWORD, never on a command line).
 * - DumpFileSource: a pg_dump file (custom format through pg_restore, or plain text) for local runs;
 *   W0 and L0 come from its own public.d1_change_log block, or are 0 with --no-change-log.
 * - PgliteSource: a PGlite data directory (local tests): the same queries, the dump through COPY.
 */
import { execFile } from "node:child_process";
import { existsSync, openSync, readFileSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { canonicalTs } from "../../src/lib/d1-time";
import { parseDumpCopyBlocks } from "./first-copy-plan";

const run = promisify(execFile);

export interface CopySource {
  readonly label: string;
  /** max(id) of public.d1_change_log now, 0 when the log is empty. Throws when there is no log. */
  maxChangeLogId(): Promise<number>;
  /** The data-only plain-text dump of the tables, from one snapshot, timestamps in UTC. */
  dumpData(tables: readonly string[]): Promise<string>;
  /** L0: the smallest id whose changed_at is at or after (W0's changed_at - 5 minutes). */
  firstIdWithinFiveMinutes(w0: number): Promise<number>;
  close(): Promise<void>;
}

export const MAX_ID_SQL = "select coalesce(max(id), 0) from public.d1_change_log";

export function l0Sql(w0: number): string {
  if (!Number.isSafeInteger(w0) || w0 < 1) throw new Error(`W0 must be a positive id, got ${w0}`);
  return (
    "select min(id) from public.d1_change_log where changed_at >= " +
    `(select changed_at from public.d1_change_log where id = ${w0}) - interval '5 minutes'`
  );
}

function parseId(text: string, what: string): number {
  const value = text.trim();
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${what}: not an id: ${value.slice(0, 40)}`);
  return Number(value);
}

function noLogHint(message: string): string {
  return /d1_change_log/.test(message) && /does not exist/.test(message)
    ? "public.d1_change_log does not exist: apply supabase/migrations/*_d1_change_log.sql first (design 5.2 step 2)"
    : message;
}

// ------------------------------------------------------------------------------------------- pooler

export function libpqBin(name: "psql" | "pg_dump" | "pg_restore"): string {
  const override = process.env[name.toUpperCase()];
  if (override) return override;
  const brew = `/opt/homebrew/opt/libpq/bin/${name}`;
  return existsSync(brew) ? brew : name;
}

export interface PoolerOptions {
  host: string;
  port: number;
  user: string;
  database: string;
  password: string;
  workDir: string;
  psql?: string;
  pgDump?: string;
}

/** Connection settings from the environment: SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD, optional SUPABASE_POOLER_HOST. */
export function poolerOptionsFromEnv(workDir: string, env = process.env): PoolerOptions {
  const ref = env.SUPABASE_PROJECT_REF;
  const password = env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) {
    throw new Error("set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD (e.g. tsx --env-file=.env.local) to dump Supabase");
  }
  return {
    host: env.SUPABASE_POOLER_HOST ?? "aws-1-ap-northeast-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    database: "postgres",
    password,
    workDir,
  };
}

export class PoolerSource implements CopySource {
  readonly label: string;
  constructor(private readonly opts: PoolerOptions) {
    this.label = `Supabase session pooler ${opts.host}:${opts.port} as ${opts.user}`;
  }

  private childEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PGHOST: this.opts.host,
      PGPORT: String(this.opts.port),
      PGUSER: this.opts.user,
      PGDATABASE: this.opts.database,
      PGPASSWORD: this.opts.password,
      PGSSLMODE: "require",
      // Design 5.2: the dump's timestamps must carry +00.
      PGTZ: "UTC",
      PGAPPNAME: "d1-first-copy",
    };
  }

  private async scalar(sql: string, what: string): Promise<number> {
    try {
      const { stdout } = await run(this.opts.psql ?? libpqBin("psql"), ["-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], {
        env: this.childEnv(),
        maxBuffer: 1 << 20,
      });
      return parseId(stdout, what);
    } catch (error) {
      throw new Error(`${what}: ${noLogHint(String((error as { stderr?: string }).stderr || (error as Error).message).trim())}`);
    }
  }

  maxChangeLogId() {
    return this.scalar(MAX_ID_SQL, "W0");
  }

  firstIdWithinFiveMinutes(w0: number) {
    return this.scalar(l0Sql(w0), "L0");
  }

  async dumpData(tables: readonly string[]): Promise<string> {
    const file = join(this.opts.workDir, "supabase-data.sql");
    const args = ["--data-only", "--format=plain", "--no-owner", "--no-privileges", "--file", file, ...tables.map((t) => `--table=public.${t}`)];
    try {
      await run(this.opts.pgDump ?? libpqBin("pg_dump"), args, { env: this.childEnv(), maxBuffer: 1 << 20 });
    } catch (error) {
      throw new Error(`pg_dump: ${String((error as { stderr?: string }).stderr || (error as Error).message).trim()}`);
    }
    return readFileSync(file, "utf8");
  }

  async close() {}
}

// ------------------------------------------------------------------------------------------- dump file

function isCustomFormat(file: string): boolean {
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(5);
    readSync(fd, head, 0, 5, 0);
    return head.toString("latin1") === "PGDMP";
  } finally {
    closeSync(fd);
  }
}

function micros(canonical: string): number {
  return Date.parse(`${canonical.slice(0, 23)}Z`) * 1000 + Number(canonical.slice(23, 26));
}

export class DumpFileSource implements CopySource {
  readonly label: string;
  private text: string | null = null;
  constructor(
    private readonly file: string,
    private readonly opts: { workDir: string; noChangeLog: boolean },
  ) {
    this.label = `dump file ${file}${opts.noChangeLog ? " (no change log: W0 = 0)" : ""}`;
  }

  private async load(): Promise<string> {
    if (this.text !== null) return this.text;
    if (isCustomFormat(this.file)) {
      const out = join(this.opts.workDir, "dump-data.sql");
      await run(libpqBin("pg_restore"), ["--data-only", "-f", out, this.file], { maxBuffer: 1 << 20 });
      this.text = readFileSync(out, "utf8");
    } else {
      this.text = readFileSync(this.file, "utf8");
    }
    return this.text;
  }

  private async logRows(): Promise<Array<{ id: number; changedAt: string }>> {
    const block = parseDumpCopyBlocks(await this.load()).get("d1_change_log");
    if (!block) {
      if (this.opts.noChangeLog) return [];
      throw new Error("the dump file has no public.d1_change_log block; pass --no-change-log to copy with W0 = 0");
    }
    return block.rows.map((row) => {
      const changedAt = canonicalTs(row.changed_at);
      if (!changedAt) throw new Error(`d1_change_log ${row.id}: changed_at is not a timestamp`);
      return { id: parseId(String(row.id), "d1_change_log.id"), changedAt };
    });
  }

  async maxChangeLogId() {
    return Math.max(0, ...(await this.logRows()).map((row) => row.id));
  }

  async firstIdWithinFiveMinutes(w0: number) {
    const rows = await this.logRows();
    const anchor = rows.find((row) => row.id === w0);
    if (!anchor) throw new Error(`L0: no change-log row ${w0}`);
    const from = micros(anchor.changedAt) - 5 * 60 * 1_000_000;
    return Math.min(...rows.filter((row) => micros(row.changedAt) >= from).map((row) => row.id));
  }

  dumpData() {
    return this.load();
  }

  async close() {}
}

// ------------------------------------------------------------------------------------------- PGlite

interface PgliteLike {
  query<T>(sql: string, params?: unknown[], options?: unknown): Promise<{ rows: T[]; blob?: Blob }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

export class PgliteSource implements CopySource {
  readonly label: string;
  private db: PgliteLike | null = null;
  constructor(private readonly dataDir: string) {
    this.label = `PGlite ${dataDir}`;
  }

  private async open(): Promise<PgliteLike> {
    if (this.db) return this.db;
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(this.dataDir) as unknown as PgliteLike;
    await db.exec("set timezone = 'UTC'");
    this.db = db;
    return db;
  }

  private async scalar(sql: string, what: string): Promise<number> {
    const db = await this.open();
    try {
      const { rows } = await db.query<Record<string, unknown>>(sql);
      return parseId(String(Object.values(rows[0] ?? {})[0] ?? ""), what);
    } catch (error) {
      throw new Error(`${what}: ${noLogHint((error as Error).message)}`);
    }
  }

  maxChangeLogId() {
    return this.scalar(MAX_ID_SQL, "W0");
  }

  firstIdWithinFiveMinutes(w0: number) {
    return this.scalar(l0Sql(w0), "L0");
  }

  async dumpData(tables: readonly string[]): Promise<string> {
    const db = await this.open();
    let out = "";
    await db.exec("begin isolation level repeatable read");
    try {
      for (const table of tables) {
        const { rows } = await db.query<{ attname: string }>(
          "select attname from pg_attribute where attrelid = ('public.' || $1)::regclass and attnum > 0 and not attisdropped order by attnum",
          [table],
        );
        const columns = rows.map((row) => (/^[a-z_][a-z0-9_]*$/.test(row.attname) && row.attname !== "character" && row.attname !== "rows" ? row.attname : `"${row.attname}"`));
        const result = await db.query(`COPY public.${table} (${columns.join(", ")}) TO '/dev/blob'`);
        const data = result.blob ? await result.blob.text() : "";
        out += `COPY public.${table} (${columns.join(", ")}) FROM stdin;\n${data}\\.\n\n`;
      }
    } finally {
      await db.exec("commit");
    }
    return out;
  }

  async close() {
    await this.db?.close();
    this.db = null;
  }
}

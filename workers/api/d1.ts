/**
 * The slice of the D1 binding the Worker uses. The repo has no
 * @cloudflare/workers-types, so the shapes are declared here (like HTMLRewriter
 * in document-locale.ts) and specs pass in-memory stubs.
 */

export type D1Meta = { changes?: number; duration?: number; rows_read?: number; rows_written?: number };

export type D1Result<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta?: D1Meta;
};

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result<unknown>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

/** Rejects after `ms`; the original promise keeps running (register it with waitUntil). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

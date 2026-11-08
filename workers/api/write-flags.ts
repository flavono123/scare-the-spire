import {
  WRITE_FLAG_GROUPS,
  isWriteMode,
  writeFlagKey,
  type WriteFlagGroup,
  type WriteMode,
} from "../../src/lib/api-write-modes";
import type { ApiSurfaceGroup } from "../../src/lib/api-surfaces";
import { withTimeout, type D1Database } from "./d1";
import type { ExecutionContextLike } from "./flags";

/**
 * Step 4 write flags (`write.<group>` = rls|worker in D1 runtime_flags,
 * docs/supabase-exit/STEP4_WRITE_GATE.md). Read only for /api/write requests
 * whose group is already on the api path, kept 30 s per isolate like the path
 * flags. A missing row or a failed read means API_WRITE_MODE_DEFAULT, which is
 * "rls" (today) unless the deploy sets it: after the browser's direct write
 * policies are closed the safe side is "worker" (plan 7.2: the Worker env
 * default is the step's safe side).
 */

export type WriteFlagsEnv = {
  DB?: D1Database;
  /** "worker" once the direct write policies are closed; anything else means "rls". */
  API_WRITE_MODE_DEFAULT?: string;
};

export const WRITE_FLAGS_SQL = "SELECT key, value FROM runtime_flags WHERE key GLOB 'write.*'";
export const WRITE_FLAGS_FRESH_MS = 30_000;
export const WRITE_FLAGS_WAIT_MS = 1_000;

type Memory = { modes: ReadonlyMap<WriteFlagGroup, WriteMode>; readAt: number };

let memory: Memory | null = null;

export function resetWriteFlagsForTest(): void {
  memory = null;
}

export function defaultWriteMode(env: WriteFlagsEnv): WriteMode {
  return env.API_WRITE_MODE_DEFAULT === "worker" ? "worker" : "rls";
}

/** Modes named by known rows; unknown keys and values are ignored (they fall to the default). */
export function parseWriteFlagRows(rows: readonly { key?: unknown; value?: unknown }[]): Map<WriteFlagGroup, WriteMode> {
  const modes = new Map<WriteFlagGroup, WriteMode>();
  for (const group of WRITE_FLAG_GROUPS) {
    const row = rows.find((candidate) => candidate.key === writeFlagKey(group));
    if (row && isWriteMode(row.value)) modes.set(group, row.value);
  }
  return modes;
}

/** The write mode of a group with /api/write routes; other groups are always "rls". */
export async function writeModeFor(
  env: WriteFlagsEnv,
  ctx: ExecutionContextLike,
  group: ApiSurfaceGroup,
  now = Date.now(),
): Promise<WriteMode> {
  const fallback = defaultWriteMode(env);
  if (!(WRITE_FLAG_GROUPS as readonly string[]).includes(group)) return "rls";
  const key = group as WriteFlagGroup;
  if (memory && now - memory.readAt < WRITE_FLAGS_FRESH_MS) return memory.modes.get(key) ?? fallback;
  if (!env.DB) return fallback;
  const db = env.DB;
  const read = (async () => {
    const result = await db.prepare(WRITE_FLAGS_SQL).all<{ key: string; value: string }>();
    const modes = parseWriteFlagRows(result.results ?? []);
    memory = { modes, readAt: Date.now() };
    return modes;
  })();
  ctx.waitUntil(read.catch(() => undefined));
  try {
    const modes = await withTimeout(read, WRITE_FLAGS_WAIT_MS);
    return modes.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

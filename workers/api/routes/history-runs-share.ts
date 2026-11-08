import { readShareBody, SHARE_UNAVAILABLE_CODE, singleRunRequired } from "../d1-write/handlers/runs";
import { apiError, jsonResponse } from "../http";
import type { UserRouteContext } from "../router";
import { postgrestStream } from "../supabase-rest";
import { isWorkerWrite } from "../write-gate/gate";
import { restErrorCode } from "./comments";
import { readAfterWrite } from "../../sync/read-after-write";

/**
 * One-run sharing while Supabase is the origin (docs/supabase-exit/STEP4_WRITE_GATE.md 9.5,
 * D1_SCHEMA_DESIGN.md 4.4 "5단계 공유 요청" 5): in worker mode (`write.history-runs = worker`) the
 * gate must not parse a batch body of raw run files (up to 24 MB) in the CPU budget, so the step 1
 * upload routes answer 409 single_run_required and the browser sends each run to
 * /api/write/history-runs/share as `[<row>,<raw>]`. Only the small row is parsed and decided by the
 * gate; the raw is spliced into the PostgREST body as a JSON string, never parsed, and the write
 * goes out with the service key. It is the batch upsert with one row: same columns, conflict rule
 * (`id,env`, duplicates ignored) and answer (`{ v, env, inserted }`).
 *
 * On the rls path the share route stays unavailable (409 single_run_unavailable) and the browser
 * keeps the batch, as before. On the D1 source (step 5) the D1 handler answers both.
 */

const STREAM_UPLOAD_MS = 25_000;

/** The step 5 list summary the browser adds for D1 (design 10.2); Supabase runs has no such columns. */
const D1_ONLY_COLUMNS = ["characters", "game_mode", "game_elements", "list_facts", "summary_version"] as const;

/** Step 1 upload routes (single and batch) in worker mode: the browser resends one run per request. */
export function workerUploadAnswer(context: UserRouteContext): Response | null {
  if (!isWorkerWrite(context)) return null;
  void context.bodyStream?.cancel().catch(() => undefined);
  return singleRunRequired();
}

export async function shareRunOnSupabase(context: UserRouteContext): Promise<Response> {
  if (!isWorkerWrite(context)) {
    void context.bodyStream?.cancel().catch(() => undefined);
    return jsonResponse({ error: SHARE_UNAVAILABLE_CODE }, { status: 409 });
  }
  const body = await readShareBody(context);
  if (!body) return apiError("invalid");
  const { row: parsed, raw } = body;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiError("invalid");
  const row: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
  delete row.raw;
  for (const column of D1_ONLY_COLUMNS) delete row[column];
  const { config, token } = context;
  const result = await postgrestStream(config, {
    method: "POST",
    path: "runs",
    token,
    deadline: Date.now() + STREAM_UPLOAD_MS,
    timeoutMs: STREAM_UPLOAD_MS,
    query: new URLSearchParams({ on_conflict: "id,env", select: "id" }),
    prefer: ["resolution=ignore-duplicates", "return=representation"],
    body: [row],
    rawText: { column: "raw", text: raw },
  });
  if (!result.ok) return apiError(restErrorCode(result));
  // Ids only: small.
  const rows = await result.response.json().catch(() => null) as { id?: unknown }[] | null;
  if (!Array.isArray(rows)) return apiError("unavailable");
  const inserted = rows.map((entry) => String(entry.id));
  await readAfterWrite(context, "write.history-runs.share", [{ op: "rereadIds", table: "runs", ids: inserted }]);
  return jsonResponse({ v: 1, env: config.dataEnv, inserted }, { status: 201 });
}

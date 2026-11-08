import { contactInquiryRow } from "../../../src/lib/contact-rules";
import { apiError, jsonResponse } from "../http";
import type { ApiRoute, UserRouteContext } from "../router";
import { postgrest } from "../supabase-rest";
import { HANDLER_BUDGET_MS, restErrorCode } from "./comments";
import { readAfterWrite } from "../../sync/read-after-write";

/**
 * The contact group (docs/supabase-exit/STEP1_DESIGN.md 9.3): the nav mailbox
 * dot and the inquiry form. Both need a session (authenticated only). The
 * table's trigger keeps its own rate limit (3 an hour) and the user check.
 */

async function handleMailbox(context: UserRouteContext): Promise<Response> {
  const { config, token } = context;
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  // RLS shows only the caller's rows; authenticated may not even read user_id, so no filter on it.
  const result = await postgrest<{ id: string }[]>(config, {
    path: "contact_inquiries",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    query: new URLSearchParams({
      select: "id",
      env: `eq.${config.dataEnv}`,
      admin_response: "not.is.null",
      reply_seen_at: "is.null",
      limit: "1",
    }),
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, unseen: (result.data ?? []).length > 0 });
}

async function handleSubmit(context: UserRouteContext): Promise<Response> {
  const body = context.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("invalid");
  const row = contactInquiryRow(body as Parameters<typeof contactInquiryRow>[0]);
  if (!row) return apiError("invalid");
  const { config, token, user } = context;
  // return=minimal: authenticated may not read back reply_email, user_id or the viewport.
  const result = await postgrest<null>(config, {
    method: "POST",
    path: "contact_inquiries",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: { ...row, user_id: user.userId, env: config.dataEnv },
    prefer: ["return=minimal"],
  });
  if (!result.ok) {
    // The trigger raises P0001 'contact_inquiry_rate_limited' past three an hour.
    if (result.code === "P0001") return apiError("rate_limited");
    return apiError(restErrorCode(result));
  }
  // return=minimal and a server-made id: the user's newest inquiry is the one just written.
  await readAfterWrite(context, "write.contact-inquiries", [
    { op: "reread", table: "contact_inquiries", match: { user_id: user.userId }, order: "created_at.desc,id.desc", then: "insert" },
  ]);
  return jsonResponse({}, { status: 201 });
}

export const contactRoutes: readonly ApiRoute[] = [
  {
    id: "me.mailbox",
    method: "GET",
    path: "/api/me/mailbox",
    group: "contact",
    access: "me",
    query: {},
    handle: handleMailbox,
  },
  {
    id: "write.contact-inquiries",
    method: "POST",
    path: "/api/write/contact-inquiries",
    group: "contact",
    access: "write",
    query: {},
    body: { maxBytes: 48 * 1024 },
    handle: handleSubmit,
  },
];

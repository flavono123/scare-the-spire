import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { ApiError, requireApiVersion, shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import { sanitizeContactSourcePath, type ContactCategory } from "@/lib/contact-rules";
import { surfacePath } from "@/lib/runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  type ContactCategory,
} from "@/lib/contact-rules";

export type ContactInquiryEnv = "development" | "production";
export type ContactInquiryStatus = "new" | "reviewing" | "done" | "spam";

export interface ContactInquiryHistoryItem {
  id: string;
  category: ContactCategory;
  message: string;
  env: ContactInquiryEnv;
  status: ContactInquiryStatus;
  adminResponse: string | null;
  /** Null when a reply exists and has not been opened. Omitted when the column is not deployed yet. */
  replySeenAt?: string | null;
  createdAt: string;
}

interface ContactInquiryHistoryRow {
  id: string;
  category: ContactCategory;
  message: string;
  env: ContactInquiryEnv;
  status: ContactInquiryStatus;
  admin_response: string | null;
  reply_seen_at?: string | null;
  created_at: string;
}

import {
  CONTACT_INQUIRY_HISTORY_COLUMNS,
  CONTACT_INQUIRY_HISTORY_COLUMNS_LEGACY,
} from "@/lib/profile-activity-rules";

export function contactReplyIsUnseen(row: {
  admin_response?: unknown;
  reply_seen_at?: unknown;
}): boolean {
  return typeof row.admin_response === "string"
    && row.admin_response.length > 0
    && (row.reply_seen_at === null || row.reply_seen_at === undefined);
}

export function isMissingContactReplySeenColumn(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /reply_seen_at/i.test(error.message ?? "");
}

export interface ContactInquiryInput {
  userId: string;
  category: ContactCategory;
  message: string;
  replyEmail: string | null;
  pagePath: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  viewportWidth: number | null;
  viewportHeight: number | null;
}

export class ContactInquiryRateLimitError extends Error {
  constructor() {
    super("contact_inquiry_rate_limited");
    this.name = "ContactInquiryRateLimitError";
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

export async function submitContactInquiry(input: ContactInquiryInput): Promise<void> {
  if (!supabaseEnabled) throw new Error("Supabase is not configured");

  // docs/supabase-exit/STEP1_DESIGN.md 9.3: the Worker fills the user id and env.
  if (surfacePath("contact") === "api") {
    try {
      await apiFetchAsUser("contact", "/api/write/contact-inquiries", {
        method: "POST",
        body: {
          category: input.category,
          message: input.message,
          replyEmail: input.replyEmail,
          pagePath: input.pagePath,
          serviceLocale: input.serviceLocale,
          gameLocale: input.gameLocale,
          viewportWidth: input.viewportWidth,
          viewportHeight: input.viewportHeight,
        },
      });
      return;
    } catch (error) {
      if (error instanceof ApiError && error.code === "rate_limited") throw new ContactInquiryRateLimitError();
      // Only a write that certainly did nothing is sent again on the legacy path.
      if (!writeMayGoLegacy(error)) throw error;
    }
  }

  const { error } = await withSupabaseTimeout(
    "contact_inquiries.insert",
    supabase.from("contact_inquiries").insert({
      user_id: input.userId,
      category: input.category,
      message: input.message.trim(),
      reply_email: input.replyEmail?.trim().toLowerCase() || null,
      page_path: sanitizeContactSourcePath(input.pagePath),
      service_locale: input.serviceLocale,
      game_locale: input.gameLocale,
      viewport_width: input.viewportWidth,
      viewport_height: input.viewportHeight,
      env: supabaseEnv,
    }),
  );

  if (!error) return;
  if (errorText(error).includes("contact_inquiry_rate_limited")) {
    throw new ContactInquiryRateLimitError();
  }
  throw error;
}

function historyItem(row: ContactInquiryHistoryRow, withSeenColumn: boolean): ContactInquiryHistoryItem {
  return {
    id: row.id,
    category: row.category,
    message: row.message,
    env: row.env,
    status: row.status,
    adminResponse: row.admin_response,
    replySeenAt: withSeenColumn && "reply_seen_at" in row ? row.reply_seen_at ?? null : undefined,
    createdAt: row.created_at,
  };
}

export async function listOwnContactInquiries(): Promise<ContactInquiryHistoryItem[]> {
  if (!supabaseEnabled) throw new Error("Supabase is not configured");

  // docs/supabase-exit/STEP1_DESIGN.md 9.4: this env's inquiries only.
  if (surfacePath("profile") === "api") {
    try {
      const body = await apiFetchAsUser<{ v?: number; rows?: ContactInquiryHistoryRow[]; replySeenColumn?: boolean }>(
        "profile",
        "/api/me/profile/inquiries",
      );
      requireApiVersion("profile", body);
      return (body.rows ?? []).map((row) => historyItem(row, body.replySeenColumn !== false));
    } catch (error) {
      if (!shouldUseLegacy(error)) throw error;
    }
  }

  const first = await withSupabaseTimeout(
    "contact_inquiries.select",
    supabase
      .from("contact_inquiries")
      .select(CONTACT_INQUIRY_HISTORY_COLUMNS)
      .order("created_at", { ascending: false })
      // ponytail: cap the first version at 50; add pagination if real users outgrow it.
      .limit(50),
  );
  const result = first.error && isMissingContactReplySeenColumn(first.error)
    ? await withSupabaseTimeout(
      "contact_inquiries.select",
      supabase
        .from("contact_inquiries")
        .select(CONTACT_INQUIRY_HISTORY_COLUMNS_LEGACY)
        .order("created_at", { ascending: false })
        .limit(50),
    )
    : first;

  if (result.error) throw result.error;
  return ((result.data ?? []) as ContactInquiryHistoryRow[]).map((row) => historyItem(row, true));
}

export async function hasUnseenContactReply(): Promise<boolean | null> {
  if (!supabaseEnabled) return null;

  if (surfacePath("contact") === "api") {
    try {
      const body = await apiFetchAsUser<{ v?: number; unseen?: unknown }>("contact", "/api/me/mailbox");
      requireApiVersion("contact", body);
      return typeof body.unseen === "boolean" ? body.unseen : null;
    } catch (error) {
      // Null keeps the dot as it was, like a failed legacy read.
      if (!shouldUseLegacy(error)) return null;
    }
  }

  try {
    const { data, error } = await withSupabaseTimeout(
      "contact_inquiries.unseen_reply",
      supabase
        .from("contact_inquiries")
        .select("id")
        .eq("env", supabaseEnv)
        .not("admin_response", "is", null)
        .is("reply_seen_at", null)
        .limit(1),
    );
    if (error) {
      if (isMissingContactReplySeenColumn(error)) return false;
      return null;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return null;
  }
}

export async function markOwnContactRepliesSeen(): Promise<void> {
  if (!supabaseEnabled) return;

  if (surfacePath("profile") === "api") {
    try {
      await apiFetchAsUser("profile", "/api/write/profile/inquiries-seen", { method: "POST" });
      return;
    } catch (error) {
      // Marking seen twice is harmless, but only a call that certainly did nothing is resent.
      if (!writeMayGoLegacy(error)) {
        console.warn("Failed to mark contact replies seen", error instanceof Error ? error.message : error);
        return;
      }
    }
  }

  const { error } = await withSupabaseTimeout(
    "contact_inquiries.reply_seen",
    supabase
      .from("contact_inquiries")
      .update({ reply_seen_at: new Date().toISOString() })
      .eq("env", supabaseEnv)
      .not("admin_response", "is", null)
      .is("reply_seen_at", null),
  );
  if (error && !isMissingContactReplySeenColumn(error)) {
    console.warn("Failed to mark contact replies seen", error.message);
  }
}

import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { sanitizeContactSourcePath } from "@/lib/contact-routing";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 8000;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

export type ContactCategory =
  | "bug"
  | "correction"
  | "feedback"
  | "report"
  | "partnership"
  | "other";

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

const CONTACT_INQUIRY_HISTORY_COLUMNS = "id,category,message,env,status,admin_response,reply_seen_at,created_at";
const CONTACT_INQUIRY_HISTORY_COLUMNS_LEGACY = "id,category,message,env,status,admin_response,created_at";

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

export async function listOwnContactInquiries(): Promise<ContactInquiryHistoryItem[]> {
  if (!supabaseEnabled) throw new Error("Supabase is not configured");

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
  return ((result.data ?? []) as ContactInquiryHistoryRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    message: row.message,
    env: row.env,
    status: row.status,
    adminResponse: row.admin_response,
    replySeenAt: "reply_seen_at" in row ? row.reply_seen_at ?? null : undefined,
    createdAt: row.created_at,
  }));
}

export async function hasUnseenContactReply(): Promise<boolean | null> {
  if (!supabaseEnabled) return null;

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

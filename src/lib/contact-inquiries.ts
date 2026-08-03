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
  createdAt: string;
}

interface ContactInquiryHistoryRow {
  id: string;
  category: ContactCategory;
  message: string;
  env: ContactInquiryEnv;
  status: ContactInquiryStatus;
  admin_response: string | null;
  created_at: string;
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

  const { data, error } = await withSupabaseTimeout(
    "contact_inquiries.select",
    supabase
      .from("contact_inquiries")
      .select("id,category,message,env,status,admin_response,created_at")
      .order("created_at", { ascending: false })
      // ponytail: cap the first version at 50; add pagination if real users outgrow it.
      .limit(50),
  );

  if (error) throw error;
  return ((data ?? []) as ContactInquiryHistoryRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    message: row.message,
    env: row.env,
    status: row.status,
    adminResponse: row.admin_response,
    createdAt: row.created_at,
  }));
}

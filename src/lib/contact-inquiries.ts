import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { ApiError, requireApiVersion } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import type { ContactCategory } from "@/lib/contact-rules";

/**
 * Contact inquiries and the profile's inquiry history, through the Worker only
 * (docs/supabase-exit/STEP1_DESIGN.md 9.3, 9.4). Step 6 (docs/supabase-exit/STEP6_PLAN.md
 * WP-D): there is no direct Supabase path, so a former legacy signal is the
 * same outage as any other (src/lib/api-client.ts).
 */

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

export interface ContactInquiryInput {
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

/** The Worker fills the user (identity cookie) and env. Throws ContactInquiryRateLimitError or an ApiError. */
export async function submitContactInquiry(input: ContactInquiryInput): Promise<void> {
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
  } catch (error) {
    if (error instanceof ApiError && error.code === "rate_limited") throw new ContactInquiryRateLimitError();
    throw error;
  }
}

function historyItem(row: ContactInquiryHistoryRow): ContactInquiryHistoryItem {
  return {
    id: row.id,
    category: row.category,
    message: row.message,
    env: row.env,
    status: row.status,
    adminResponse: row.admin_response,
    replySeenAt: "reply_seen_at" in row ? row.reply_seen_at ?? null : undefined,
    createdAt: row.created_at,
  };
}

/** This env's inquiries only (docs/supabase-exit/STEP1_DESIGN.md 9.4). Throws on any failure. */
export async function listOwnContactInquiries(): Promise<ContactInquiryHistoryItem[]> {
  const body = await apiFetchAsUser<{ v?: number; rows?: ContactInquiryHistoryRow[] }>(
    "profile",
    "/api/me/profile/inquiries",
  );
  requireApiVersion("profile", body);
  return (body.rows ?? []).map(historyItem);
}

/** Null on any failure, which keeps the mailbox dot as it was. */
export async function hasUnseenContactReply(): Promise<boolean | null> {
  try {
    const body = await apiFetchAsUser<{ v?: number; unseen?: unknown }>("contact", "/api/me/mailbox");
    requireApiVersion("contact", body);
    return typeof body.unseen === "boolean" ? body.unseen : null;
  } catch {
    return null;
  }
}

/** Marking seen twice is harmless; a failure is only logged. */
export async function markOwnContactRepliesSeen(): Promise<void> {
  try {
    await apiFetchAsUser("profile", "/api/write/profile/inquiries-seen", { method: "POST" });
  } catch (error) {
    console.warn("Failed to mark contact replies seen", error instanceof Error ? error.message : error);
  }
}

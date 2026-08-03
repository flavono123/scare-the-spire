import type { GameLocale, ServiceLocale } from "@/lib/i18n";
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

export function sanitizeContactSourcePath(value: string | null | undefined): string {
  const path = value?.trim().split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 512) || "/";
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

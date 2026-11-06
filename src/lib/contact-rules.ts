/**
 * Contact inquiry rules shared by the page, the legacy insert and the Worker's
 * /api/write/contact-inquiries (docs/supabase-exit/STEP1_DESIGN.md 9.3). No
 * imports: the Worker bundle uses it. Mirrors the table's CHECK constraints.
 */

export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 8000;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

export const CONTACT_CATEGORIES = ["bug", "correction", "feedback", "report", "partnership", "other"] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const CONTACT_SERVICE_LOCALES = ["ko", "en"] as const;
export const CONTACT_GAME_LOCALES = [
  "kor", "eng", "zhs", "jpn", "deu", "fra", "ita", "spa", "esp", "ptb", "rus", "pol", "tha", "tur",
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+[.][^\s@]+$/;

export function sanitizeContactSourcePath(value: string | null | undefined): string {
  const path = value?.trim().split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 512) || "/";
}

export type ContactInquiryRow = {
  category: ContactCategory;
  message: string;
  reply_email: string | null;
  page_path: string;
  service_locale: string;
  game_locale: string;
  viewport_width: number | null;
  viewport_height: number | null;
};

function viewport(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 10000 ? (value as number) : undefined;
}

/** The row to insert, or null when the input breaks a rule the table would refuse. */
export function contactInquiryRow(input: {
  category: unknown;
  message: unknown;
  replyEmail: unknown;
  pagePath: unknown;
  serviceLocale: unknown;
  gameLocale: unknown;
  viewportWidth: unknown;
  viewportHeight: unknown;
}): ContactInquiryRow | null {
  if (typeof input.category !== "string" || !(CONTACT_CATEGORIES as readonly string[]).includes(input.category)) return null;
  if (typeof input.message !== "string") return null;
  const message = input.message.trim();
  const length = Array.from(message).length;
  if (length < CONTACT_MESSAGE_MIN_LENGTH || length > CONTACT_MESSAGE_MAX_LENGTH) return null;
  let email: string | null = null;
  if (input.replyEmail !== null && input.replyEmail !== undefined) {
    if (typeof input.replyEmail !== "string") return null;
    const trimmed = input.replyEmail.trim().toLowerCase();
    if (trimmed) {
      if (trimmed.length < 3 || trimmed.length > CONTACT_EMAIL_MAX_LENGTH || !EMAIL.test(trimmed)) return null;
      email = trimmed;
    }
  }
  if (input.category === "partnership" && !email) return null;
  if (typeof input.pagePath !== "string" && input.pagePath !== null && input.pagePath !== undefined) return null;
  if (typeof input.serviceLocale !== "string" || !(CONTACT_SERVICE_LOCALES as readonly string[]).includes(input.serviceLocale)) return null;
  if (typeof input.gameLocale !== "string" || !(CONTACT_GAME_LOCALES as readonly string[]).includes(input.gameLocale)) return null;
  const width = viewport(input.viewportWidth);
  const height = viewport(input.viewportHeight);
  if (width === undefined || height === undefined) return null;
  return {
    category: input.category as ContactCategory,
    message,
    reply_email: email,
    page_path: sanitizeContactSourcePath(input.pagePath as string | null | undefined),
    service_locale: input.serviceLocale,
    game_locale: input.gameLocale,
    viewport_width: width,
    viewport_height: height,
  };
}

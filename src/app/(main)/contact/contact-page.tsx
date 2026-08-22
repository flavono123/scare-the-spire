"use client";

import { useState } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  ContactInquiryRateLimitError,
  submitContactInquiry,
  type ContactCategory,
} from "@/lib/contact-inquiries";
import { sanitizeContactSourcePath } from "@/lib/contact-routing";
import type { FeedbackFormGameCopy } from "@/lib/borrowed-game-copy";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { supabaseEnabled } from "@/lib/supabase";
import type { ContactMessages } from "@/messages/contact";

const CATEGORY_ICONS: Record<ContactCategory, string> = {
  bug: "/images/sts2/ui/emote/exclaim.png",
  correction: "/images/sts2/ui/emote/question.png",
  feedback: "/images/sts2/ui/emote/thumb_up.png",
  report: "/images/sts2/ui/emote/thumb_down.png",
  partnership: "/images/sts2/ui/emote/heart.png",
  other: "/images/sts2/ui/emote/happy_cultist.png",
};

const CATEGORY_ORDER = [
  "bug",
  "correction",
  "feedback",
  "report",
  "partnership",
  "other",
] as const satisfies readonly ContactCategory[];

type SubmitState = "idle" | "submitting" | "success" | "rate-limited" | "unavailable";

export default function ContactPage({
  copy,
  feedbackCopy,
  mailboxTitle,
  serviceLocale,
  gameLocale,
}: {
  copy: ContactMessages;
  feedbackCopy: FeedbackFormGameCopy;
  mailboxTitle: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const { userId, ready: authReady, unavailable: authUnavailable, ensureUser } = useAuth();
  const [category, setCategory] = useState<ContactCategory | null>(null);
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const trimmedMessage = message.trim();
  const trimmedEmail = replyEmail.trim();
  const partnershipEmailMissing = category === "partnership" && trimmedEmail.length === 0;
  const unavailable = !supabaseEnabled || authUnavailable || submitState === "unavailable";
  const submitted = submitState === "success";
  const submitting = submitState === "submitting";
  const submitDisabled =
    !authReady
    || unavailable
    || submitting
    || submitted
    || partnershipEmailMissing
    || trimmedMessage.length < CONTACT_MESSAGE_MIN_LENGTH;

  const resetForm = () => {
    setMessage("");
    setReplyEmail("");
    setCategory(null);
    setSubmitState("idle");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled) return;

    setSubmitState("submitting");
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) {
        setSubmitState("unavailable");
        return;
      }

      await submitContactInquiry({
        userId: activeUserId,
        category: category ?? "other",
        message: trimmedMessage,
        replyEmail: trimmedEmail || null,
        pagePath: sanitizeContactSourcePath(
          new URLSearchParams(window.location.search).get("from") ?? window.location.pathname,
        ),
        serviceLocale,
        gameLocale,
        viewportWidth: window.innerWidth || null,
        viewportHeight: window.innerHeight || null,
      });
      setSubmitState("success");
    } catch (error) {
      setSubmitState(error instanceof ContactInquiryRateLimitError ? "rate-limited" : "unavailable");
    }
  };

  return (
    <div className="relative min-h-[calc(100svh-3rem)] overflow-hidden bg-background px-3 py-8 text-foreground sm:px-6 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(239,200,81,0.13),transparent_34%),radial-gradient(circle_at_88%_78%,rgba(125,55,125,0.12),transparent_30%)]"
      />

      <main
        data-contact-page
        data-auth-ready={authReady ? "true" : "false"}
        className="relative mx-auto w-full max-w-3xl"
      >
        <header className="mb-5 flex items-center gap-4 sm:mb-7">
          <span className="relative flex h-20 w-20 shrink-0 items-center justify-center sm:h-24 sm:w-24">
            <span className="absolute inset-[18%] rounded-full bg-amber-300/15 blur-xl" aria-hidden="true" />
            <Image
              src="/images/sts2/relics/tiny_mailbox.webp"
              alt=""
              width={96}
              height={96}
              className="relative h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)]"
            />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary/80">
              {copy.eyebrow}
            </p>
            <h1 className="font-game-title text-3xl font-black text-foreground sm:text-4xl">
              {mailboxTitle}
            </h1>
          </div>
        </header>

        <section data-contact-form-panel className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <LockKeyhole className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
            <span>{copy.privateNote}</span>
          </div>

          {unavailable ? (
            <StorageUnavailableNotice title={copy.unavailableTitle} className="min-h-80" />
          ) : submitted ? (
            <div className="flex min-h-96 flex-col items-center justify-center gap-4 px-5 py-14 text-center" role="status">
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/8">
                <Image
                  src="/images/sts2/ui/emote/happy_cultist.png"
                  alt=""
                  width={72}
                  height={72}
                  className="h-16 w-16 object-contain drop-shadow-lg"
                />
                <CheckCircle2 className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-card p-1 text-emerald-700 dark:bg-[#0b0a12] dark:text-emerald-300" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-game-title text-2xl font-black text-emerald-800 dark:text-emerald-200">
                  {feedbackCopy.sendSuccessLabel}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{copy.successDetail}</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="mt-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/16"
              >
                {copy.sendAnother}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
              <fieldset>
                <legend className="mb-3 font-game-title text-lg font-black text-foreground">
                  {feedbackCopy.categoryLabel}
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORY_ORDER.map((categoryId) => {
                    const categoryCopy = copy.categories[categoryId];
                    return (
                      <label key={categoryId} className="cursor-pointer">
                        <input
                          type="radio"
                          name="contact-category"
                          value={categoryId}
                          checked={category === categoryId}
                          onChange={() => setCategory(categoryId)}
                          className="peer sr-only"
                        />
                        <span className="flex min-h-[5.5rem] items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 transition-[border-color,background-color,transform] hover:border-primary/40 hover:bg-primary/8 peer-checked:border-primary/60 peer-checked:bg-primary/12 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background sm:min-h-[6.25rem] sm:flex-col sm:justify-center sm:text-center">
                          <Image
                            src={CATEGORY_ICONS[categoryId]}
                            alt=""
                            width={38}
                            height={38}
                            className="h-9 w-9 shrink-0 object-contain drop-shadow-md sm:h-10 sm:w-10"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-foreground sm:text-sm">
                              {categoryCopy.label}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-1.5 block font-game-title text-lg font-black text-foreground">
                  {copy.messageLabel}
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, CONTACT_MESSAGE_MAX_LENGTH))}
                  placeholder={feedbackCopy.descriptionPlaceholder}
                  minLength={CONTACT_MESSAGE_MIN_LENGTH}
                  maxLength={CONTACT_MESSAGE_MAX_LENGTH}
                  rows={8}
                  required
                  className="min-h-48 w-full resize-y rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/45 focus:bg-card sm:text-base"
                />
                <span className="mt-1.5 block text-right text-[11px] tabular-nums text-muted-foreground">
                  {message.length.toLocaleString()} / {CONTACT_MESSAGE_MAX_LENGTH.toLocaleString()}
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-foreground">
                  {copy.emailLabel}
                </span>
                <input
                  type="email"
                  value={replyEmail}
                  onChange={(event) => setReplyEmail(event.target.value.slice(0, CONTACT_EMAIL_MAX_LENGTH))}
                  maxLength={CONTACT_EMAIL_MAX_LENGTH}
                  required={category === "partnership"}
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="h-11 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
                />
                {category === "partnership" && (
                  <span className="mt-1.5 block text-xs text-primary">
                    {copy.partnershipEmailHint}
                  </span>
                )}
              </label>

              <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                <p>{copy.privacyNote}</p>
                <p>{copy.sourceNote}</p>
              </div>

              {submitState === "rate-limited" && (
                <p
                  className="rounded-lg border border-red-700/30 bg-red-600/8 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-300/25 dark:bg-red-300/8 dark:text-red-200"
                  role="alert"
                >
                  {copy.rateLimited}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="inline-flex h-11 min-w-28 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/12 px-5 font-game-title text-base font-black text-primary shadow-sm transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/18 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 motion-reduce:transform-none"
                >
                  {submitting && <EngagementSpinner size={15} />}
                  {submitting ? feedbackCopy.sendingLabel : feedbackCopy.sendLabel}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

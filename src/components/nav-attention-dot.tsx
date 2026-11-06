/** Shared transparent token box. Dots anchor to this box, not the opaque pixels. */
export const NAV_ATTENTION_SLOT_CLASS =
  "relative inline-flex h-6 w-6 shrink-0 items-center justify-center sm:h-7 sm:w-7";

/**
 * - `unread`: gold sine pip for new posts.
 * - `new-service`: emerald ripple pip for a newly added service.
 * - `inbox`: larger red ripple pip for inquiries the operator has not
 *   checked yet (dev only). It outranks the other two.
 */
export type NavAttentionTone = "unread" | "new-service" | "inbox";

const TONE_CLASS: Record<NavAttentionTone, string> = {
  unread: "",
  "new-service": " nav-attention-dot-new",
  inbox: " nav-attention-dot-inbox",
};

export function NavAttentionDot({
  marker,
  dormant = false,
  placement = "corner",
  tone = "unread",
}: {
  marker?: string;
  dormant?: boolean;
  placement?: "corner" | "trail";
  tone?: NavAttentionTone;
}) {
  return (
    <span
      aria-hidden
      hidden={dormant}
      data-nav-attention={marker}
      data-nav-attention-tone={tone === "unread" ? undefined : tone}
      className={`nav-attention-dot${placement === "trail" ? " nav-attention-dot-trail" : ""}${TONE_CLASS[tone]}`}
    />
  );
}

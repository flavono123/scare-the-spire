/** Shared transparent token box. Dots anchor to this box, not the opaque pixels. */
export const NAV_ATTENTION_SLOT_CLASS =
  "relative inline-flex h-6 w-6 shrink-0 items-center justify-center sm:h-7 sm:w-7";

export function NavAttentionDot({
  marker,
  dormant = false,
  placement = "corner",
}: {
  marker?: string;
  dormant?: boolean;
  placement?: "corner" | "trail";
}) {
  return (
    <span
      aria-hidden
      hidden={dormant}
      data-nav-attention={marker}
      className={placement === "trail" ? "nav-attention-dot nav-attention-dot-trail" : "nav-attention-dot"}
    />
  );
}

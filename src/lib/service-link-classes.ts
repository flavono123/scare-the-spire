/**
 * Link roles: game resources gold, in-site pages aqua, off-site pages blue.
 * The aqua/blue colors are `--link-internal` / `--link-external` in
 * globals.css so editors (CSS) and viewers (classes) share one source.
 */

export const RESOURCE_LINK_CLASS =
  "font-game-title font-semibold spire-gold hover:text-primary underline decoration-primary/30 underline-offset-2 transition-colors cursor-pointer";

export const SERVICE_LINK_CLASS =
  "service-aqua font-semibold underline underline-offset-2 transition-colors hover:opacity-80";

/** Text color alone, for chips and icons that are not underlined prose. */
export const INTERNAL_LINK_TEXT_CLASS = "text-(--link-internal)";
export const EXTERNAL_LINK_TEXT_CLASS = "text-(--link-external)";

/** In-site prose links, in viewers and editors alike. */
export const INTERNAL_PROSE_LINK_CLASS =
  `font-semibold ${INTERNAL_LINK_TEXT_CLASS} no-underline border-b border-(--link-internal)/70 transition-colors hover:brightness-125`;

/** Off-site prose links, in viewers and editors alike. */
export const EXTERNAL_PROSE_LINK_CLASS =
  `font-semibold ${EXTERNAL_LINK_TEXT_CLASS} underline decoration-(--link-external) decoration-1 underline-offset-[3px] transition-colors hover:brightness-125`;

/** Off-site links open in a new tab; in-site links stay in this one. */
export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href);
}

/** 섀소식 titles and YouTube chips without forcing an underline. */
export const SERVICE_ACCENT_CLASS = "service-aqua";

export function classNameForHref(href: string): string {
  if (isExternalHref(href)) return EXTERNAL_PROSE_LINK_CLASS;

  const path = (href.split(/[?#]/)[0] ?? href).toLowerCase();
  if (path.includes("byrdispatch")) return INTERNAL_PROSE_LINK_CLASS;
  if (
    path.includes("/compendium")
    || path.includes("/codex")
    || path.includes("/patches")
    || /(?:^|\/)cards(?:\/|$)/.test(path)
    || /(?:^|\/)relics(?:\/|$)/.test(path)
    || /(?:^|\/)potions(?:\/|$)/.test(path)
  ) {
    return RESOURCE_LINK_CLASS;
  }

  return INTERNAL_PROSE_LINK_CLASS;
}

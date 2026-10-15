/** Link roles from DESIGN.md: game resources gold, byrdispatch/external aqua. */

export const RESOURCE_LINK_CLASS =
  "font-game-title font-semibold spire-gold hover:text-primary underline decoration-primary/30 underline-offset-2 transition-colors cursor-pointer";

export const SERVICE_LINK_CLASS =
  "service-aqua font-semibold underline underline-offset-2 transition-colors hover:opacity-80";

/** In-site prose links on byrdispatch, Pagestorm, and C-C-C-Combo. */
export const INTERNAL_PROSE_LINK_CLASS =
  "font-semibold text-[#2aebbe] no-underline border-b border-[#2aebbe]/70 transition-colors hover:brightness-125";

/** Off-site prose links on byrdispatch, Pagestorm, and C-C-C-Combo. */
export const EXTERNAL_PROSE_LINK_CLASS =
  "font-semibold text-[#60a5fa] underline decoration-[#60a5fa] decoration-1 underline-offset-[3px] transition-colors hover:text-blue-300";

/** 섀소식 titles and YouTube chips without forcing an underline. */
export const SERVICE_ACCENT_CLASS = "service-aqua";

export function classNameForHref(href: string): string {
  if (/^(https?:\/\/|mailto:)/i.test(href)) return SERVICE_LINK_CLASS;

  const path = (href.split(/[?#]/)[0] ?? href).toLowerCase();
  if (path.includes("byrdispatch")) return SERVICE_LINK_CLASS;
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

  return SERVICE_LINK_CLASS;
}

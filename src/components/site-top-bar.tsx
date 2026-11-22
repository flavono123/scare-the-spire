import Link from "next/link";
import type { ReactNode } from "react";
import { NAV_ATTENTION_SLOT_CLASS, NavAttentionDot } from "@/components/nav-attention-dot";
import Image from "@/components/ui/static-image";
import { INTERNAL_TOKEN_LINK_CLASS } from "@/lib/service-link-classes";
import type { TopBarLink, TopBarMenuRow } from "@/lib/top-bar-menu";

// One top bar for the main app and the static patch pages. No hooks: the patch
// build renders it with renderToStaticMarkup, and attachTopBar
// (src/lib/top-bar-controller.ts) adds hover, sorting and the phone sheet.

export type TopBarLanguage = { locale: string; href: string; label: string; active: boolean; gameOnly: boolean };

const POPOVER_CLASS = "patch-static-dropdown relative group";
const PANEL_CLASS = "absolute z-50 mt-1 rounded-md border border-border bg-background/95 shadow-xl backdrop-blur-sm";

function NewMark({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded border border-emerald-400/40 bg-emerald-500/15 px-1 text-[9px] font-bold leading-4 tracking-[0.06em] text-emerald-700 dark:text-emerald-300">
      {label}
    </span>
  );
}

function PopoverButton({ icon, label, children }: { icon: string; label: string; children?: ReactNode }) {
  return (
    <summary
      aria-label={label}
      aria-haspopup="menu"
      className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground group-open:text-foreground sm:px-1.5"
    >
      <span className={NAV_ATTENTION_SLOT_CLASS}>
        <Image src={icon} alt="" width={28} height={28} className="h-full w-full object-contain brightness-90 transition-all group-hover:brightness-110 group-open:brightness-125" />
        {children}
      </span>
      <span className="max-sm:sr-only">{label}</span>
    </summary>
  );
}

function MenuItem({ item, order, unread, newLabel }: { item: TopBarLink; order: number; unread: boolean; newLabel: string }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      role="menuitem"
      data-menu-item={item.id}
      data-order={order}
      data-fold={item.fold || undefined}
      data-new={item.isNew || undefined}
      className="relative flex w-[8.5rem] shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-foreground/85 transition-colors hover:bg-white/[0.07] hover:text-foreground data-[overflow=true]:hidden max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:flex-col max-sm:gap-0.5 max-sm:text-xs"
    >
      <Image src={item.token} alt="" width={22} height={22} className={`${item.tokenClassName ?? "h-5 w-5"} shrink-0 object-contain`} />
      <span className="min-w-0 max-w-full truncate">{item.label}</span>
      {item.isNew && (
        <span className="max-sm:absolute max-sm:right-0.5 max-sm:top-0.5">
          <NewMark label={newLabel} />
        </span>
      )}
      {item.attentionId && (
        <NavAttentionDot placement="trail" marker={item.attentionId} dormant={!unread} />
      )}
    </Link>
  );
}

export function SiteTopBar({
  brand,
  patches,
  menu,
  search,
  profile,
  dev,
  unreadIds = [],
}: {
  brand: { href: string; label: string };
  patches: { href: string; label: string; items: TopBarLink[]; attention?: boolean; attentionMarker?: string };
  menu: {
    label: string;
    rows: TopBarMenuRow[];
    newLabel: string;
    /** "+{count} 더보기" */
    moreLabel: string;
    allHref: string;
    allLabel: string;
    attention?: boolean;
    attentionMarker?: string;
  };
  search: ReactNode;
  profile: { href: string; label: string; icon: ReactNode; languageLabel: string; languages: TopBarLanguage[] };
  dev?: ReactNode;
  /** nav-seen surfaces with new posts (main app); static pages reveal dots by marker instead. */
  unreadIds?: readonly string[];
}) {
  const unread = new Set(unreadIds);
  const menuHasNew = menu.rows.some((row) => row.items.some((item) => item.isNew));

  return (
    <div className="mx-auto flex h-12 items-center gap-1 px-2 sm:gap-2 sm:px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1.5">
        <Link
          href={brand.href}
          prefetch={false}
          className="flex shrink-0 items-center gap-1 pr-1 text-sm font-bold text-primary sm:gap-1.5 sm:text-base"
        >
          <Image src="/images/bone_tea.png" alt="" width={22} height={22} className="h-[18px] w-[18px] object-contain sm:h-[22px] sm:w-[22px]" />
          <span className="max-[560px]:sr-only">{brand.label}</span>
        </Link>

        <details data-top-bar-popover="patches" data-static-nav-dropdown data-href={patches.href} className={POPOVER_CLASS}>
          <PopoverButton icon="/images/sts2/nav/patch_notes_icon.png" label={patches.label}>
            {(patches.attention || patches.attentionMarker) && (
              <NavAttentionDot marker={patches.attentionMarker} dormant={!patches.attention} />
            )}
          </PopoverButton>
          <div role="menu" aria-label={patches.label} className={`${PANEL_CLASS} left-0 min-w-[11rem] py-1`}>
            {patches.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/85 transition-colors hover:bg-white/[0.07] hover:text-foreground"
              >
                <Image src={item.token} alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.attentionId && (
                  <NavAttentionDot placement="trail" marker={item.attentionId} dormant={!unread.has(item.attentionId)} />
                )}
              </Link>
            ))}
          </div>
        </details>

        <details data-top-bar-popover="menu" data-static-nav-dropdown data-href={menu.allHref} className={POPOVER_CLASS}>
          <PopoverButton icon="/images/sts2/ui/topbar/top_bar_map.png" label={menu.label}>
            {menuHasNew ? (
              <NavAttentionDot tone="new-service" />
            ) : (menu.attention || menu.attentionMarker) && (
              <NavAttentionDot marker={menu.attentionMarker} dormant={!menu.attention} />
            )}
          </PopoverButton>
          {/* The header's backdrop blur makes it the containing block of `fixed`, so the phone sheet sets its own height. */}
          <div
            role="menu"
            aria-label={menu.label}
            className={`${PANEL_CLASS} left-0 w-[min(46rem,calc(100vw-1rem))] space-y-1 p-2 max-sm:fixed max-sm:inset-x-0 max-sm:top-12 max-sm:h-[calc(100dvh-3rem)] max-sm:z-[45] max-sm:mt-0 max-sm:w-auto max-sm:overflow-y-auto max-sm:rounded-none max-sm:border-x-0 max-sm:p-3`}
          >
            {menu.rows.map((row) => (
              <section key={row.area} data-menu-row={row.area} className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch max-sm:gap-1 max-sm:border-b max-sm:border-border/50 max-sm:pb-2">
                <Link
                  href={row.href}
                  prefetch={false}
                  role="menuitem"
                  className="flex w-[9.5rem] shrink-0 items-center gap-1.5 font-game-title text-sm text-primary hover:text-primary/80 max-sm:w-auto"
                >
                  <Image src={row.token} alt="" width={22} height={22} className="h-5 w-5 shrink-0 object-contain" />
                  <span className="truncate">{row.title}</span>
                </Link>
                <div data-menu-items className="flex min-w-0 flex-1 gap-1 overflow-hidden">
                  {row.items.map((item, index) => (
                    <MenuItem
                      key={item.id}
                      item={item}
                      order={index}
                      unread={Boolean(item.attentionId && unread.has(item.attentionId))}
                      newLabel={menu.newLabel}
                    />
                  ))}
                  <Link
                    href={row.href}
                    prefetch={false}
                    role="menuitem"
                    data-menu-more
                    data-label={menu.moreLabel}
                    hidden
                    className="order-[999] flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                  >
                    <span data-menu-more-count />
                  </Link>
                </div>
              </section>
            ))}
            <div className="px-2 pt-1 text-right">
              <Link href={menu.allHref} prefetch={false} role="menuitem" className={`${INTERNAL_TOKEN_LINK_CLASS} text-xs`}>
                <Image src="/images/sts2/ui/topbar/top_bar_map.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                {menu.allLabel}
              </Link>
            </div>
          </div>
        </details>
        {dev}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1">
        {search}
        <details data-top-bar-popover="profile" data-static-nav-dropdown className={POPOVER_CLASS}>
          <summary
            aria-label={profile.label}
            aria-haspopup="menu"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-white/5"
          >
            {profile.icon}
          </summary>
          <div role="menu" aria-label={profile.label} className={`${PANEL_CLASS} right-0 max-h-[min(32rem,calc(100svh-4rem))] w-[14.5rem] overflow-y-auto py-1`}>
            <Link
              href={profile.href}
              prefetch={false}
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground hover:bg-white/[0.07]"
            >
              {profile.label}
            </Link>
            <div className="mt-1 border-t border-border/70 px-3 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
              {profile.languageLabel}
            </div>
            {profile.languages.map((language, index) => (
              <div key={language.locale}>
                {language.gameOnly && !profile.languages[index - 1]?.gameOnly && (
                  <div className="my-1 border-t border-border/70 px-3 pb-1 pt-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/70">only game locale</span>
                  </div>
                )}
                <a
                  href={language.href}
                  role="menuitem"
                  data-locale-pref={language.locale}
                  aria-current={language.active ? "true" : undefined}
                  className={`block px-3 py-1.5 text-sm font-semibold transition-colors ${
                    language.active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/5"
                  }`}
                >
                  {language.label}
                </a>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

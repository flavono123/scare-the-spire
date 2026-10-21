"use client";

import Link from "next/link";
import { MenuDropdown } from "@/components/menu-dropdown";
import { NAV_ATTENTION_SLOT_CLASS, NavAttentionDot } from "@/components/nav-attention-dot";
import Image from "@/components/ui/static-image";
import type { NavDropdownItem } from "@/lib/site-nav-items";

function MenuRow({
  item,
  nested = false,
}: {
  item: NavDropdownItem;
  nested?: boolean;
}) {
  const showMarker = Boolean(item.attention || item.attentionId);
  return (
    <Link
      href={item.href}
      prefetch={false}
      role="menuitem"
      className={`flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground ${
        nested ? "ml-3 border-l border-border/60" : ""
      }`}
    >
      <Image
        src={item.icon}
        alt=""
        width={18}
        height={18}
        className={`${item.iconClassName ?? "h-[18px] w-[18px]"} shrink-0 object-contain`}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {(item.isNew || showMarker) && (
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {item.isNew && (
            <span className="rounded-full border border-emerald-700/35 bg-emerald-600/10 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-200">
              NEW
            </span>
          )}
          {showMarker && (
            <NavAttentionDot
              placement="trail"
              marker={item.attentionId}
              dormant={Boolean(item.attentionId) && !item.attention}
            />
          )}
        </span>
      )}
    </Link>
  );
}

function groupItems(items: NavDropdownItem[]): Array<{ group: string; items: NavDropdownItem[] }> {
  const groups: Array<{ group: string; items: NavDropdownItem[] }> = [];
  for (const item of items) {
    const group = item.group ?? "";
    const last = groups.at(-1);
    if (last && last.group === group) last.items.push(item);
    else groups.push({ group, items: [item] });
  }
  return groups;
}

type SiteNavDropdownProps = {
  icon: string;
  alt: string;
  items: NavDropdownItem[];
  align?: "left" | "right";
  /** `grid` lays groups out as columns so long menus stay short. */
  layout?: "list" | "grid";
  attention?: boolean;
  /** Static patch HTML renders a hidden dot; patch-nav-indicators.js reveals it. */
  attentionMarker?: string;
};

export function SiteNavDropdown({
  icon,
  alt,
  items,
  align = "right",
  layout = "list",
  attention = false,
  attentionMarker,
}: SiteNavDropdownProps) {
  const grid = layout === "grid";

  return (
    <MenuDropdown
      ariaLabel={alt}
      staticNav
      summaryClassName="flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-1 transition-colors hover:bg-white/5 sm:gap-1 sm:px-1.5"
      menuClassName={`${
        grid
          ? // The sticky header blurs its backdrop, so `fixed` resolves against the
          // header box: a phone-width sheet right under the bar.
          "max-sm:fixed max-sm:inset-x-2 max-sm:top-12 sm:w-[46rem] max-h-[calc(100svh-4.5rem)]"
          : "min-w-[140px] max-h-[min(24rem,calc(100svh-4.5rem))]"
      } overflow-y-auto ${align === "right" ? "right-0" : "left-0"}`}
      summary={(
        <>
          <span className={NAV_ATTENTION_SLOT_CLASS}>
            <Image
              src={icon}
              alt={alt}
              width={28}
              height={28}
              className="h-full w-full rounded-sm object-contain brightness-90 transition-all hover:brightness-110 group-open:brightness-125"
            />
            {(attention || attentionMarker) && (
              <NavAttentionDot marker={attentionMarker} dormant={Boolean(attentionMarker) && !attention} />
            )}
          </span>
          <svg
            className="hidden h-3 w-3 text-muted-foreground transition-transform group-open:rotate-180 sm:block"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </>
      )}
    >
      {grid ? (
        <div className="grid grid-cols-2 gap-x-1 sm:grid-cols-4">
          {groupItems(items).map(({ group, items: groupedItems }) => (
            <div key={group} className="min-w-0">
              {group && (
                <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-primary/80">
                  {group}
                </div>
              )}
              {groupedItems.map((item) => (
                <MenuRow key={item.href} item={item} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          {items.map((item, index) => (
            <div key={item.href}>
              {item.group && item.group !== items[index - 1]?.group && (
                <div className="border-t border-border/60 px-3 pb-1 pt-2 text-[11px] font-semibold text-primary/80 first:border-t-0">
                  {item.group}
                </div>
              )}
              <MenuRow item={item} />
              {item.children?.map((child) => (
                <MenuRow key={child.href} item={child} nested />
              ))}
            </div>
          ))}
        </>
      )}
    </MenuDropdown>
  );
}

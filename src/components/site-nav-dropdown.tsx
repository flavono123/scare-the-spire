"use client";

import Link from "next/link";
import { MenuDropdown } from "@/components/menu-dropdown";
import { NAV_ATTENTION_SLOT_CLASS, NavAttentionDot } from "@/components/nav-attention-dot";
import Image from "@/components/ui/static-image";
import type { NavDropdownItem } from "@/lib/site-nav-items";

function MenuRow({
  item,
  isToyBox,
  nested = false,
}: {
  item: NavDropdownItem;
  isToyBox: boolean;
  nested?: boolean;
}) {
  const showMarker = Boolean(item.attention || item.attentionId);
  return (
    <Link
      href={item.href}
      prefetch={false}
      role="menuitem"
      className={`flex items-center gap-2.5 px-3 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground ${
        nested ? "ml-3 border-l border-border/60" : ""
      } ${isToyBox ? "py-2 font-service" : "py-1.5"}`}
    >
      <Image
        src={item.icon}
        alt=""
        width={isToyBox ? 24 : 18}
        height={isToyBox ? 24 : 18}
        className={`${
          isToyBox ? "h-6 w-6" : item.iconClassName ?? "h-[18px] w-[18px]"
        } shrink-0 object-contain`}
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

type SiteNavDropdownProps = {
  icon: string;
  alt: string;
  items: NavDropdownItem[];
  align?: "left" | "right";
  variant?: "default" | "toyBox";
  attention?: boolean;
  /** Static patch HTML renders a hidden dot; patch-nav-indicators.js reveals it. */
  attentionMarker?: string;
};

export function SiteNavDropdown({
  icon,
  alt,
  items,
  align = "right",
  variant = "default",
  attention = false,
  attentionMarker,
}: SiteNavDropdownProps) {
  const isToyBox = variant === "toyBox";

  return (
    <MenuDropdown
      ariaLabel={alt}
      staticNav
      summaryClassName="flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-1 transition-colors hover:bg-white/5 sm:gap-1 sm:px-1.5"
      menuClassName={`${
        isToyBox ? "min-w-[190px]" : "min-w-[140px]"
      } max-h-[min(24rem,calc(100svh-4.5rem))] overflow-y-auto ${align === "right" ? "right-0" : "left-0"}`}
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
      <>
        {isToyBox && (
          <div className="border-b border-border/60 px-3 pb-2 pt-1.5 font-service text-xs font-semibold text-muted-foreground">
            {alt}
          </div>
        )}
        {items.map((item) => (
          <div key={item.href}>
            <MenuRow item={item} isToyBox={isToyBox} />
            {item.children?.map((child) => (
              <MenuRow key={child.href} item={child} isToyBox={isToyBox} nested />
            ))}
          </div>
        ))}
      </>
    </MenuDropdown>
  );
}

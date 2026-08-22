"use client";

import Link from "next/link";
import { MenuDropdown } from "@/components/menu-dropdown";
import Image from "@/components/ui/static-image";
import type { NavDropdownItem } from "@/lib/site-nav-items";

type SiteNavDropdownProps = {
  icon: string;
  alt: string;
  items: NavDropdownItem[];
  align?: "left" | "right";
  variant?: "default" | "toyBox";
};

export function SiteNavDropdown({
  icon,
  alt,
  items,
  align = "right",
  variant = "default",
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
          <Image
            src={icon}
            alt={alt}
            width={28}
            height={28}
            className="h-6 w-6 rounded-sm object-contain brightness-90 transition-all group-open:brightness-125 hover:brightness-110 sm:h-7 sm:w-7"
          />
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
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            role="menuitem"
            className={`flex items-center gap-2.5 px-3 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground ${
              isToyBox ? "py-2 font-service" : "py-1.5"
            }`}
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
            <span className="min-w-0 truncate">{item.label}</span>
            {item.isNew && (
              <span className="ml-auto shrink-0 rounded-full border border-emerald-700/35 bg-emerald-600/10 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-200">
                NEW
              </span>
            )}
          </Link>
        ))}
      </>
    </MenuDropdown>
  );
}

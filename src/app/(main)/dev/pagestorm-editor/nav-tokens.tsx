"use client";

import { MenuDropdown } from "@/components/menu-dropdown";
import Image from "@/components/ui/static-image";
import type { NavDropdownItem } from "@/lib/site-nav-items";

export function PickerNavDropdown({
  icon,
  alt,
  items,
  align = "left",
  variant = "default",
  onPick,
}: {
  icon: string;
  alt: string;
  items: NavDropdownItem[];
  align?: "left" | "right";
  variant?: "default" | "toyBox";
  onPick: (item: NavDropdownItem) => void;
}) {
  const isToyBox = variant === "toyBox";
  const itemClass = `flex w-full items-center gap-2.5 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground ${
    isToyBox ? "py-2 font-service" : "py-1.5"
  }`;
  const iconClass = `${
    isToyBox ? "h-6 w-6" : "h-[18px] w-[18px]"
  } shrink-0 object-contain`;

  return (
    <MenuDropdown
      ariaLabel={alt}
      staticNav
      summaryClassName="flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-1 transition-colors hover:bg-white/5 sm:gap-1 sm:px-1.5"
      menuClassName={`${
        isToyBox ? "min-w-[190px]" : "min-w-[140px]"
      } z-[80] max-h-[min(24rem,calc(100svh-4.5rem))] overflow-y-auto ${align === "right" ? "right-0" : "left-0"}`}
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
          <div key={item.href}>
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => onPick(item)}
            >
              <Image
                src={item.icon}
                alt=""
                width={isToyBox ? 24 : 18}
                height={isToyBox ? 24 : 18}
                className={item.iconClassName ?? iconClass}
              />
              <span className="min-w-0 truncate">{item.label}</span>
              {item.isNew ? (
                <span className="ml-auto shrink-0 rounded-full border border-emerald-700/35 bg-emerald-600/10 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-200">
                  NEW
                </span>
              ) : null}
            </button>
            {item.children?.map((child) => (
              <button
                key={child.href}
                type="button"
                role="menuitem"
                className={`${itemClass} ml-3 border-l border-border/60`}
                onClick={() => onPick(child)}
              >
                <Image
                  src={child.icon}
                  alt=""
                  width={isToyBox ? 24 : 18}
                  height={isToyBox ? 24 : 18}
                  className={child.iconClassName ?? iconClass}
                />
                <span className="min-w-0 truncate">{child.label}</span>
              </button>
            ))}
          </div>
        ))}
      </>
    </MenuDropdown>
  );
}

export function NavTokenChip({
  item,
  pressed,
  onClick,
}: {
  item: NavDropdownItem;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
        pressed
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
      onClick={onClick}
    >
      <Image
        src={item.icon}
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px] object-contain"
      />
      <span className="max-w-[7rem] truncate">{item.label}</span>
    </button>
  );
}

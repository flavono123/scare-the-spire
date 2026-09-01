"use client";

import { MenuDropdown } from "@/components/menu-dropdown";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
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
  const iconClass = `${
    isToyBox ? "h-6 w-6" : "h-[18px] w-[18px]"
  } shrink-0 object-contain`;

  return (
    <MenuDropdown
      ariaLabel={alt}
      staticNav
      summaryClassName="flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-1 transition-colors hover:bg-white/5 sm:gap-1 sm:px-1.5"
      menuClassName={`z-[80] w-max min-w-[10rem] max-h-[min(24rem,calc(100svh-4.5rem))] overflow-y-auto ${align === "right" ? "right-0" : "left-0"}`}
      summary={(
        <GameUiHoverTip label={alt} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
          <span className="inline-flex items-center">
            <Image
              src={icon}
              alt={alt}
              width={28}
              height={28}
              className="h-6 w-6 rounded-sm object-contain brightness-90 transition-all group-open:brightness-125 hover:brightness-110 sm:h-7 sm:w-7"
            />
          </span>
        </GameUiHoverTip>
      )}
    >
      <div className="grid grid-cols-4 gap-0.5 p-1">
        {items.flatMap((item) => [item, ...(item.children ?? [])]).map((item) => (
          <GameUiHoverTip
            key={item.href}
            label={item.label}
            delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
          >
            <button
              type="button"
              role="menuitem"
              aria-label={item.label}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              onClick={() => onPick(item)}
            >
              <Image
                src={item.icon}
                alt=""
                width={isToyBox ? 24 : 18}
                height={isToyBox ? 24 : 18}
                className={item.iconClassName ?? iconClass}
              />
            </button>
          </GameUiHoverTip>
        ))}
      </div>
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

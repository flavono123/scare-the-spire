"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

interface MenuDropdownProps {
  ariaLabel: string;
  children: ReactNode;
  menuClassName?: string;
  rootClassName?: string;
  staticNav?: boolean;
  summary: ReactNode;
  summaryClassName?: string;
}

export function MenuDropdown({
  ariaLabel,
  children,
  menuClassName = "",
  rootClassName = "",
  staticNav = false,
  summary,
  summaryClassName = "",
}: MenuDropdownProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useCallback(() => ref.current?.removeAttribute("open"), []);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    const handleToggle = () => {
      if (!details.open) return;
      document
        .querySelectorAll<HTMLDetailsElement>("details[data-menu-dropdown][open]")
        .forEach((other) => {
          if (other !== details) other.removeAttribute("open");
        });
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    details.addEventListener("toggle", handleToggle);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      details.removeEventListener("toggle", handleToggle);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close]);

  return (
    <details
      ref={ref}
      data-menu-dropdown
      data-static-nav-dropdown={staticNav || undefined}
      className={`patch-static-dropdown relative group ${rootClassName}`}
    >
      <summary
        className={summaryClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
      >
        {summary}
      </summary>
      <div
        role="menu"
        aria-label={ariaLabel}
        onClick={(event) => {
          if (
            event.target instanceof Element
            && event.target.closest('[role="menuitem"]')
          ) {
            close();
          }
        }}
        className={`absolute top-full z-50 mt-1 rounded-md border border-border bg-background py-1 shadow-lg ${menuClassName}`}
      >
        {children}
      </div>
    </details>
  );
}

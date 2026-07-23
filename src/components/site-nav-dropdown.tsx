"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
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
  const ref = useRef<HTMLDetailsElement>(null);
  const isToyBox = variant === "toyBox";

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    function handleToggle() {
      if (!details.open) return;
      document
        .querySelectorAll<HTMLDetailsElement>("details[data-static-nav-dropdown][open]")
        .forEach((other) => {
          if (other !== details) other.removeAttribute("open");
        });
    }

    function handlePointerDown(event: PointerEvent) {
      if (details.open && !details.contains(event.target as Node)) {
        details.removeAttribute("open");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") details.removeAttribute("open");
    }

    details.addEventListener("toggle", handleToggle);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      details.removeEventListener("toggle", handleToggle);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details
      ref={ref}
      data-static-nav-dropdown
      className="patch-static-dropdown relative group"
    >
      <summary
        className="flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-1 transition-colors hover:bg-white/5 sm:gap-1 sm:px-1.5"
        title={alt}
        aria-label={alt}
      >
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
      </summary>
      <div
        className={`absolute top-full z-50 mt-1 rounded-md border border-border bg-background py-1 shadow-lg ${
          isToyBox ? "min-w-[190px]" : "min-w-[140px]"
        } ${align === "right" ? "right-0" : "left-0"}`}
      >
        {isToyBox && (
          <div className="border-b border-border/60 px-3 pb-2 pt-1.5 font-service text-xs font-semibold text-zinc-300">
            {alt}
          </div>
        )}
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={() => ref.current?.removeAttribute("open")}
            className={`flex items-center gap-2.5 px-3 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground ${
              isToyBox ? "py-2 font-service" : "py-1.5"
            }`}
          >
            <Image
              src={item.icon}
              alt=""
              width={isToyBox ? 24 : 18}
              height={isToyBox ? 24 : 18}
              className={`${isToyBox ? "h-6 w-6" : ""} shrink-0 object-contain`}
            />
            <span className="min-w-0 truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// --- Dropdown data ---

const sts2Items = [
  { href: "/codex/cards", label: "카드", icon: "/images/sts2/nav/stats_cards.png" },
  { href: "/codex/relics", label: "유물", icon: "/images/sts2/relics/bing_bong.webp" },
  { href: "/codex/potions", label: "포션", icon: "/images/sts2/potions/potion_shaped_rock.webp" },
  { href: "/codex/powers", label: "파워", icon: "/images/sts2/powers/unmovable_power.webp" },
  { href: "/codex/enchantments", label: "인챈트", icon: "/images/sts2/enchantments/souls_power.webp" },
  { href: "/codex/monsters", label: "몬스터", icon: "/images/sts2/nav/happy_cultist.png" },
  { href: "/codex/events", label: "이벤트", icon: "/images/sts2/nav/question_mark.png" },
  { href: "/codex/encounters", label: "인카운터", icon: "/images/sts2/nav/stats_monsters.png" },
  { href: "/codex/ancients", label: "고대의 존재", icon: "/images/sts2/nav/stats_ancients.png" },
];

const sts1Items = [
  { href: "/cards", label: "카드", icon: "/images/sts2/nav/stats_cards.png" },
  { href: "/relics", label: "유물", icon: "/images/sts2/relics/snecko_eye.webp" },
  { href: "/potions", label: "포션", icon: "/images/sts2/nav/stats_potions.png" },
];

// --- Nav icon with game-style tooltip ---

function NavIconLink({
  href,
  icon,
  label,
  iconSize = 20,
  iconClassName,
  external,
}: {
  href: string;
  icon: string;
  label: string;
  iconSize?: number;
  iconClassName?: string;
  external?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const Tag = external ? "a" : Link;
  const extraProps = external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <div className="relative group">
      <Tag
        href={href}
        {...extraProps}
        className="flex items-center rounded-md p-1.5 hover:bg-white/5 transition-colors"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Image
          src={icon}
          alt={label}
          width={iconSize}
          height={iconSize}
          className={`object-contain brightness-90 hover:brightness-110 transition-all ${iconClassName ?? ""}`}
        />
      </Tag>
      {hovered && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 z-50 pointer-events-none">
          <div
            className="relative whitespace-nowrap"
            style={{
              borderImage: "url('/images/sts2/ui/hover_tip.png') 43 91 32 55 fill",
              borderImageWidth: "16px 34px 12px 20px",
              borderStyle: "solid",
              padding: "2px 12px 6px 8px",
            }}
          >
            <span
              className="font-[family-name:var(--font-kreon)] text-xs font-bold"
              style={{
                color: "rgb(239, 200, 81)",
                textShadow: "2px 1px 0 rgba(0,0,0,0.25)",
              }}
            >
              {label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Dropdown component ---

function GameDropdown({
  icon,
  alt,
  items,
  align = "right",
}: {
  icon: string;
  alt: string;
  items: { href: string; label: string; icon: string }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-white/5 transition-colors"
        title={alt}
      >
        <Image
          src={icon}
          alt={alt}
          width={28}
          height={28}
          className={`rounded-sm transition-all ${open ? "brightness-125" : "brightness-90 hover:brightness-110"}`}
        />
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1 min-w-[140px] rounded-md border border-border bg-background shadow-lg py-1 z-50 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <Image
                src={item.icon}
                alt=""
                width={18}
                height={18}
                className="object-contain shrink-0"
              />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main navbar ---

export function SiteNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex items-center justify-between px-4 h-12">
        {/* Left: brand + services */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-base font-bold text-yellow-500 shrink-0"
          >
            슬서운 이야기
            <Image
              src="/images/bone_tea.png"
              alt=""
              width={22}
              height={22}
              className="object-contain"
            />
          </Link>

          <nav className="flex items-center gap-2 text-sm">
            <NavIconLink
              href="/patches"
              icon="/images/sts2/nav/patch_notes_icon.png"
              label="패치노트"
              iconSize={22}
              iconClassName="group-hover:rotate-[8deg]"
            />
            <NavIconLink
              href="/chemical-x"
              icon="/images/sts2/relics/chemical_x.webp"
              label="케미컬X"
              iconSize={18}
            />
          </nav>
        </div>

        {/* Right: game dropdowns */}
        <div className="flex items-center gap-1">
          <GameDropdown
            icon="/images/sts2/icons/app_icon.png"
            alt="STS2 백과사전"
            items={sts2Items}
            align="right"
          />
          <GameDropdown
            icon="/images/sts1_app_icon.png"
            alt="STS1"
            items={sts1Items}
            align="right"
          />
        </div>
      </div>
    </header>
  );
}

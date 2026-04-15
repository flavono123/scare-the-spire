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

          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/patches"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <Image
                src="/images/sts2/nav/patch_notes_icon.png"
                alt=""
                width={20}
                height={20}
                className="transition-transform group-hover:rotate-[8deg]"
              />
              패치노트
            </Link>

            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfLZydnMSOswE22Z5P_BwVk5Jhxm_zfaytknV2_wIk444--NQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Image
                src="/images/sts2/icons/gold_icon.webp"
                alt=""
                width={16}
                height={16}
                className="object-contain"
              />
              제보
            </a>
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

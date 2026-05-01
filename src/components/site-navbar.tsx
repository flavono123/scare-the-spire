"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import {
  GAME_LOCALE_LABELS,
  GAME_LOCALES,
  getGameLocaleFromSearch,
  getServiceLocaleFromPath,
  localizeHref,
  switchServiceLocaleHref,
  withGameLocaleSearch,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

// --- Dropdown data ---

const sts2Items = [
  { href: "/codex/cards", labelKey: "cards", icon: "/images/sts2/nav/stats_cards.png" },
  { href: "/codex/relics", labelKey: "relics", icon: "/images/sts2/relics/bing_bong.webp" },
  { href: "/codex/potions", labelKey: "potions", icon: "/images/sts2/potions/potion_shaped_rock.webp" },
  { href: "/codex/powers", labelKey: "powers", icon: "/images/sts2/powers/unmovable_power.webp" },
  { href: "/codex/enchantments", labelKey: "enchantments", icon: "/images/sts2/enchantments/souls_power.webp" },
  { href: "/codex/monsters", labelKey: "monsters", icon: "/images/sts2/nav/happy_cultist.png" },
  { href: "/codex/events", labelKey: "events", icon: "/images/sts2/nav/question_mark.png" },
  { href: "/codex/encounters", labelKey: "encounters", icon: "/images/sts2/nav/stats_monsters.png" },
  { href: "/codex/ancients", labelKey: "ancients", icon: "/images/sts2/nav/stats_ancients.png" },
] as const;

const sts1Items = [
  { href: "/cards", labelKey: "cards", icon: "/images/sts2/nav/stats_cards.png" },
  { href: "/relics", labelKey: "relics", icon: "/images/sts2/relics/snecko_eye.webp" },
  { href: "/potions", labelKey: "potions", icon: "/images/sts2/nav/stats_potions.png" },
] as const;

type CodexLabelKey = keyof typeof serviceMessages.ko.codex;

function localizeNavItems<T extends { href: string; labelKey: CodexLabelKey; icon: string }>(
  items: readonly T[],
  locale: ServiceLocale,
) {
  const messages = serviceMessages[locale];
  return items.map((item) => ({
    href: localizeHref(item.href, locale),
    label: messages.codex[item.labelKey],
    icon: item.icon,
  }));
}

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
  const internalProps = external ? {} : { prefetch: false as const };

  return (
    <div className="relative group">
      <Tag
        href={href}
        {...extraProps}
        {...internalProps}
        className="flex items-center p-1.5 transition-colors"
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
              className="text-xs font-bold"
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
              prefetch={false}
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

function GameLocaleSelect({
  value,
  serviceLocale,
  label,
}: {
  value: GameLocale;
  serviceLocale: ServiceLocale;
  label: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => {
        const nextLocale = event.target.value as GameLocale;
        const search = withGameLocaleSearch(
          new URLSearchParams(searchParams.toString()),
          nextLocale,
          serviceLocale,
        );
        router.push(`${pathname}${search}`);
      }}
      className="h-7 max-w-[9rem] rounded border border-border bg-background px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus:text-foreground"
    >
      {GAME_LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {GAME_LOCALE_LABELS[locale][serviceLocale]}
        </option>
      ))}
    </select>
  );
}

// --- Main navbar ---

export function SiteNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serviceLocale = getServiceLocaleFromPath(pathname);
  const gameLocale = getGameLocaleFromSearch(
    new URLSearchParams(searchParams.toString()),
    serviceLocale,
  );
  const messages = serviceMessages[serviceLocale];
  const nextLocale: ServiceLocale = serviceLocale === "ko" ? "en" : "ko";
  const localeSwitchSearch = withGameLocaleSearch(
    new URLSearchParams(searchParams.toString()),
    gameLocale,
    nextLocale,
  );
  const localeSwitchHref = switchServiceLocaleHref(
    pathname,
    nextLocale,
    localeSwitchSearch,
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex items-center justify-between px-4 h-12">
        {/* Left: brand + services */}
        <div className="flex items-center gap-4">
          <Link
            href={localizeHref("/", serviceLocale)}
            prefetch={false}
            className="flex items-center gap-1.5 text-base font-bold text-yellow-500 shrink-0"
          >
            {messages.brand}
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
              href={localizeHref("/patches", serviceLocale)}
              icon="/images/sts2/nav/patch_notes_icon.png"
              label={messages.nav.patches}
              iconSize={22}
              iconClassName="group-hover:rotate-[8deg]"
            />
            <NavIconLink
              href={localizeHref("/chemical-x", serviceLocale)}
              icon="/images/sts2/relics/chemical_x.webp"
              label={messages.nav.chemicalX}
              iconSize={18}
              iconClassName="group-hover:rotate-[8deg]"
            />
            <NavIconLink
              href={localizeHref("/history-course", serviceLocale)}
              icon="/images/sts2/relics/history_course.webp"
              label={messages.nav.historyCourse}
              iconSize={20}
              iconClassName="group-hover:rotate-[8deg]"
            />
          </nav>
        </div>

        {/* Right: game dropdowns */}
        <div className="flex items-center gap-1">
          <GameLocaleSelect
            value={gameLocale}
            serviceLocale={serviceLocale}
            label={messages.gameLocaleSelect}
          />
          <GameDropdown
            icon="/images/sts2/icons/app_icon.png"
            alt={messages.games.sts2Codex}
            items={localizeNavItems(sts2Items, serviceLocale)}
            align="right"
          />
          <GameDropdown
            icon="/images/sts1_app_icon.png"
            alt={messages.games.sts1}
            items={localizeNavItems(sts1Items, serviceLocale)}
            align="right"
          />
          <Link
            href={localeSwitchHref}
            prefetch={false}
            className="ml-1 rounded px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            title={messages.serviceLocaleSwitch}
          >
            {nextLocale.toUpperCase()}
          </Link>
        </div>
      </div>
    </header>
  );
}

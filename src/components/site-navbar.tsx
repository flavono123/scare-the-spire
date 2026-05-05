"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import {
  GAME_LOCALE_LABELS,
  GAME_LOCALES,
  SERVICE_LOCALES,
  getGameLocaleFromSearch,
  getServiceLocaleFromPath,
  localizeHrefWithGameLocale,
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
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
) {
  const messages = serviceMessages[serviceLocale];
  return items.map((item) => ({
    href: localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale),
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
    <label
      className="flex h-8 items-center gap-1.5 rounded-md bg-background/70 px-2 transition-colors hover:bg-white/5 focus-within:bg-white/5"
      title={`${label}: ${GAME_LOCALE_LABELS[value][serviceLocale]}`}
    >
      <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
        {label}
      </span>
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
        className="h-6 max-w-[8.5rem] bg-transparent text-xs font-semibold text-foreground outline-none"
      >
        {GAME_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {GAME_LOCALE_LABELS[locale][serviceLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}

function ServiceLocaleSwitch({
  currentLocale,
  hrefs,
  label,
}: {
  currentLocale: ServiceLocale;
  hrefs: Record<ServiceLocale, string>;
  label: string;
}) {
  return (
    <div
      className="flex h-8 items-center gap-1 rounded-md bg-background/70 px-2"
      aria-label={label}
    >
      <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center rounded border border-border bg-black/15 p-0.5">
        {SERVICE_LOCALES.map((locale) => {
          const content = (
            <span className="px-1.5 py-0.5 text-[11px] font-semibold">
              {serviceMessages[locale].serviceLocaleName}
            </span>
          );

          return locale === currentLocale ? (
            <span
              key={locale}
              aria-current="true"
              className="rounded-sm bg-yellow-500/15 text-yellow-300"
            >
              {content}
            </span>
          ) : (
            <Link
              key={locale}
              href={hrefs[locale]}
              prefetch={false}
              className="rounded-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
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
  const serviceLocaleHrefs = Object.fromEntries(
    SERVICE_LOCALES.map((locale) => {
      const search = withGameLocaleSearch(
        new URLSearchParams(searchParams.toString()),
        gameLocale,
        locale,
      );
      return [locale, switchServiceLocaleHref(pathname, locale, search)];
    }),
  ) as Record<ServiceLocale, string>;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex items-center justify-between px-4 h-12">
        {/* Left: brand + services */}
        <div className="flex items-center gap-4">
          <Link
            href={localizeHrefWithGameLocale("/", serviceLocale, gameLocale)}
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
              href={localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale)}
              icon="/images/sts2/nav/patch_notes_icon.png"
              label={messages.nav.patches}
              iconSize={22}
              iconClassName="group-hover:rotate-[8deg]"
            />
            <NavIconLink
              href={localizeHrefWithGameLocale("/chemical-x", serviceLocale, gameLocale)}
              icon="/images/sts2/relics/chemical_x.webp"
              label={messages.nav.chemicalX}
              iconSize={18}
              iconClassName="group-hover:rotate-[8deg]"
            />
            <NavIconLink
              href={localizeHrefWithGameLocale("/history-course", serviceLocale, gameLocale)}
              icon="/images/sts2/relics/history_course.webp"
              label={messages.nav.historyCourse}
              iconSize={20}
              iconClassName="group-hover:rotate-[8deg]"
            />
          </nav>
        </div>

        {/* Right: locale controls + game dropdowns */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-white/[0.03] p-1">
            <ServiceLocaleSwitch
              currentLocale={serviceLocale}
              hrefs={serviceLocaleHrefs}
              label={messages.serviceLocaleSelect}
            />
            <div className="h-5 w-px bg-border" aria-hidden="true" />
            <GameLocaleSelect
              value={gameLocale}
              serviceLocale={serviceLocale}
              label={messages.gameLocaleSelect}
            />
          </div>
          <GameDropdown
            icon="/images/sts2/icons/app_icon.png"
            alt={messages.games.sts2Codex}
            items={localizeNavItems(sts2Items, serviceLocale, gameLocale)}
            align="right"
          />
          <GameDropdown
            icon="/images/sts1_app_icon.png"
            alt={messages.games.sts1}
            items={localizeNavItems(sts1Items, serviceLocale, gameLocale)}
            align="right"
          />
        </div>
      </div>
    </header>
  );
}

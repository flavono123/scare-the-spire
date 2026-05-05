"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import {
  GAME_LOCALE_NATIVE_LABELS,
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

type CodexLabelKey = {
  [Key in keyof typeof serviceMessages.ko.codex]:
    (typeof serviceMessages.ko.codex)[Key] extends string ? Key : never;
}[keyof typeof serviceMessages.ko.codex];

const serviceLanguageLocales = ["kor", "eng"] as const satisfies readonly GameLocale[];

const gameOnlyLanguageLocales = [
  "zhs",
  "deu",
  "esp",
  "fra",
  "ita",
  "jpn",
  "pol",
  "ptb",
  "rus",
  "spa",
  "tha",
  "tur",
] as const satisfies readonly GameLocale[];

function serviceLocaleForLanguage(gameLocale: GameLocale): ServiceLocale {
  return gameLocale === "kor" ? "ko" : "en";
}

function languageHref(
  pathname: string,
  searchParams: URLSearchParams,
  gameLocale: GameLocale,
) {
  const serviceLocale = serviceLocaleForLanguage(gameLocale);
  const search = withGameLocaleSearch(searchParams, gameLocale, serviceLocale);
  return switchServiceLocaleHref(pathname, serviceLocale, search);
}

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

function LanguageDropdown({
  value,
  label,
}: {
  value: GameLocale;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 min-w-[5.75rem] max-w-[8.25rem] items-center justify-between gap-2 rounded-md border border-border bg-background/80 px-2.5 text-left text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-white/5"
      >
        <span className="truncate">{GAME_LOCALE_NATIVE_LABELS[value]}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-yellow-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M10 14.5 3.5 5.5h13L10 14.5Z" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 max-h-[min(32rem,calc(100vh-4rem))] w-[14.5rem] overflow-y-auto rounded-md border border-border bg-background/95 py-1 shadow-xl"
        >
          {serviceLanguageLocales.map((locale) => {
            const active = locale === value;
            const href = languageHref(
              pathname,
              new URLSearchParams(searchParams.toString()),
              locale,
            );

            return (
              <Link
                key={locale}
                href={href}
                prefetch={false}
                role="menuitem"
                aria-current={active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-yellow-500/10 text-yellow-300"
                    : "text-foreground hover:bg-white/5"
                }`}
              >
                <span className="truncate text-base font-semibold" title={GAME_LOCALE_NATIVE_LABELS[locale]}>
                  {GAME_LOCALE_NATIVE_LABELS[locale]}
                </span>
              </Link>
            );
          })}
          <div className="my-1 border-t border-border/70 px-3 pt-2 pb-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/70">
              only game locale
            </span>
          </div>
          {gameOnlyLanguageLocales.map((locale) => {
            const active = locale === value;
            const href = languageHref(
              pathname,
              new URLSearchParams(searchParams.toString()),
              locale,
            );

            return (
              <Link
                key={locale}
                href={href}
                prefetch={false}
                role="menuitem"
                aria-current={active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-yellow-500/10 text-yellow-300"
                    : "text-foreground hover:bg-white/5"
                }`}
              >
                <span className="block truncate text-base font-semibold" title={GAME_LOCALE_NATIVE_LABELS[locale]}>
                  {GAME_LOCALE_NATIVE_LABELS[locale]}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LocaleCanonicalizer({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const expectedServiceLocale = serviceLocaleForLanguage(gameLocale);
    if (serviceLocale === expectedServiceLocale) return;

    router.replace(
      languageHref(
        pathname,
        new URLSearchParams(searchParams.toString()),
        gameLocale,
      ),
    );
  }, [gameLocale, pathname, router, searchParams, serviceLocale]);

  return null;
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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <LocaleCanonicalizer serviceLocale={serviceLocale} gameLocale={gameLocale} />
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

        {/* Right: language + game dropdowns */}
        <div className="flex items-center gap-1">
          <LanguageDropdown value={gameLocale} label={messages.languageSelect} />
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

"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import Image from "@/components/ui/static-image";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  GAME_LOCALE_NATIVE_LABELS,
  GAME_LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  SERVICE_LOCALE_COOKIE,
  getGameLocaleFromPathname,
  getGameLocaleFromSearch,
  getServiceLocaleForGameLocale,
  getServiceLocaleFromPath,
  hasGameLocalePathPrefix,
  isGameLocale,
  isServiceLocale,
  localizeHrefWithGameLocale,
  switchGameLocaleHref,
  withGameLocaleSearch,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { detectGameLocaleFromNavigator } from "@/lib/locale-detection";
import {
  globalSearchItemScore,
  globalSearchResultKey,
  globalSearchTypeOrder,
  globalSearchTypeStyles,
  type GlobalSearchIndexItem,
} from "@/lib/global-search";
import { useStoredUserProfile } from "@/hooks/use-user-profile";
import { characterIconUrl } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { pushCodexHistoryState } from "@/components/codex/use-hydration-safe-search-param";
import {
  getToyBoxNavItems,
  gameOnlyLanguageNavLocales,
  legacySts1NavItems,
  localizeCodexNavItems,
  serviceLanguageNavLocales,
  sts1NavItems,
  sts2NavItems,
  type NavDropdownItem,
} from "@/lib/site-nav-items";

type PendingSearchResult = {
  key: string;
};

function isPlainPrimaryClick(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
}

function pushSamePathUrl(href: string): boolean {
  if (typeof window === "undefined") return false;
  const targetUrl = new URL(href, window.location.href);
  if (targetUrl.origin !== window.location.origin) return false;
  if (targetUrl.pathname !== window.location.pathname) return false;

  const nextUrl = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return true;

  pushCodexHistoryState(nextUrl);
  return true;
}

function locationMatchesSearchTarget(href: string): boolean {
  if (typeof window === "undefined") return false;

  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(href, window.location.href);
  if (currentUrl.origin !== targetUrl.origin) return false;
  if (currentUrl.pathname !== targetUrl.pathname) return false;

  for (const [key, value] of targetUrl.searchParams.entries()) {
    if ((currentUrl.searchParams.get(key) ?? "").toLowerCase() !== value.toLowerCase()) {
      return false;
    }
  }
  return true;
}

const pendingPowerCounts = [6, 5, 4, 3, 2, 1] as const;
const pendingNavigationPaintDelayMs = 80;

function GlobalSearchPendingIndicator() {
  const [countIndex, setCountIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCountIndex((index) => (index + 1) % pendingPowerCounts.length);
    }, 120);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
      <Image
        src="/images/sts2/powers/withering_presence_power.webp"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
      />
      <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 rounded bg-black/75 px-0.5 font-game-text text-[9px] font-bold leading-none text-zinc-100 shadow-[0_0_3px_rgba(0,0,0,0.85)] tabular-nums">
        {pendingPowerCounts[countIndex]}
      </span>
    </span>
  );
}

function languageHref(
  pathname: string,
  searchParams: URLSearchParams,
  gameLocale: GameLocale,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const search = withGameLocaleSearch(searchParams, gameLocale, serviceLocale);
  return switchGameLocaleHref(pathname, gameLocale, search);
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? cookie.slice(prefix.length) : null;
}

function getLocalePreference(): GameLocale | null {
  const gameLocale = readCookie(GAME_LOCALE_COOKIE);
  if (gameLocale && isGameLocale(gameLocale)) return gameLocale;

  const serviceLocale = readCookie(SERVICE_LOCALE_COOKIE);
  if (serviceLocale && isServiceLocale(serviceLocale)) {
    return DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale];
  }

  return null;
}

function writeLocalePreferenceCookies(gameLocale: GameLocale) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const cookieSuffix = `Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  document.cookie = `${SERVICE_LOCALE_COOKIE}=${serviceLocale}; ${cookieSuffix}`;
  document.cookie = `${GAME_LOCALE_COOKIE}=${gameLocale}; ${cookieSuffix}`;
}

// --- Nav icon with game-style tooltip ---

function NavIconLink({
  href,
  icon,
  label,
  iconSize = 20,
  iconClassName,
  className,
  external,
}: {
  href: string;
  icon: string;
  label: string;
  iconSize?: number;
  iconClassName?: string;
  className?: string;
  external?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const Tag = external ? "a" : Link;
  const extraProps = external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
  const internalProps = external ? {} : { prefetch: false as const };

  return (
    <div className={`relative group ${className ?? ""}`}>
      <Tag
        href={href}
        {...extraProps}
        {...internalProps}
        className="flex items-center p-1 transition-colors sm:p-1.5"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Image
          src={icon}
          alt={label}
          width={iconSize}
          height={iconSize}
          className={`h-[18px] w-[18px] object-contain brightness-90 hover:brightness-110 transition-all sm:h-[var(--nav-icon-size)] sm:w-[var(--nav-icon-size)] ${iconClassName ?? ""}`}
          style={{ "--nav-icon-size": `${iconSize}px` } as React.CSSProperties}
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
  variant = "default",
}: {
  icon: string;
  alt: string;
  items: NavDropdownItem[];
  align?: "left" | "right";
  variant?: "default" | "toyBox";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isToyBox = variant === "toyBox";

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
        className="flex items-center gap-0.5 rounded-md px-1 py-1 hover:bg-white/5 transition-colors sm:gap-1 sm:px-1.5"
        title={alt}
      >
        <Image
          src={icon}
          alt={alt}
          width={28}
          height={28}
          className={`h-6 w-6 rounded-sm transition-all sm:h-7 sm:w-7 ${open ? "brightness-125" : "brightness-90 hover:brightness-110"}`}
        />
        <svg
          className={`hidden h-3 w-3 text-muted-foreground transition-transform sm:block ${open ? "rotate-180" : ""}`}
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
          className={`absolute top-full mt-1 rounded-md border border-border bg-background shadow-lg py-1 z-50 ${
            isToyBox ? "min-w-[190px]" : "min-w-[140px]"
          } ${
            align === "right" ? "right-0" : "left-0"
          }`}
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
              onClick={() => setOpen(false)}
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
        className="flex h-8 min-w-[4.5rem] max-w-[5.5rem] items-center justify-between gap-1 rounded-md border border-border bg-background/80 px-2 text-left text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-white/5 sm:min-w-[5.75rem] sm:max-w-[8.25rem] sm:gap-2 sm:px-2.5 sm:text-sm"
      >
        <span className="truncate">{GAME_LOCALE_NATIVE_LABELS[value]}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-yellow-400 transition-transform sm:h-4 sm:w-4 ${open ? "rotate-180" : ""}`}
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
          {serviceLanguageNavLocales.map((locale) => {
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
                onClick={() => {
                  writeLocalePreferenceCookies(locale);
                  setOpen(false);
                }}
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
          {gameOnlyLanguageNavLocales.map((locale) => {
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
                onClick={() => {
                  writeLocalePreferenceCookies(locale);
                  setOpen(false);
                }}
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

function InitialLocaleDetector() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hasGameLocalePathPrefix(pathname)) return;
    if (searchParams.has("gl")) return;
    if (getLocalePreference()) return;

    const currentHash = window.location.hash;
    const detectedGameLocale = detectGameLocaleFromNavigator(navigator);
    const targetHref = languageHref(
      pathname,
      new URLSearchParams(searchParams.toString()),
      detectedGameLocale,
    );
    const currentSearch = searchParams.toString();
    const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;

    if (targetHref !== currentHref) {
      router.replace(`${targetHref}${currentHash}`);
    }
  }, [pathname, router, searchParams]);

  return null;
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
    const currentHash = window.location.hash;
    const legacyGameLocale = searchParams.get("gl");
    if (legacyGameLocale && isGameLocale(legacyGameLocale)) {
      router.replace(
        `${languageHref(
          pathname,
          new URLSearchParams(searchParams.toString()),
          legacyGameLocale,
        )}${currentHash}`,
      );
      return;
    }

    if (hasGameLocalePathPrefix(pathname)) return;

    const savedGameLocale = getLocalePreference();
    if (!savedGameLocale) return;

    const expectedServiceLocale = getServiceLocaleForGameLocale(savedGameLocale);
    if (gameLocale === savedGameLocale && serviceLocale === expectedServiceLocale) {
      return;
    }

    router.replace(
      `${languageHref(
        pathname,
        new URLSearchParams(searchParams.toString()),
        savedGameLocale,
      )}${currentHash}`,
    );
  }, [gameLocale, pathname, router, searchParams, serviceLocale]);

  return null;
}

function GlobalSearch({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GlobalSearchIndexItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingResult, setPendingResult] = useState<PendingSearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingNavigationTimerRef = useRef<number | null>(null);
  const pendingPollTimerRef = useRef<number | null>(null);
  const pendingCloseTimerRef = useRef<number | null>(null);
  const pendingFallbackTimerRef = useRef<number | null>(null);
  const copy = serviceMessages[serviceLocale].globalSearch;
  const labels = copy.labels;
  const portalRoot = typeof document === "undefined" ? null : document.body;

  const loadIndex = useCallback(async () => {
    if (loaded) return;
    const response = await fetch("/generated/search-index.json");
    if (!response.ok) return;
    const data = await response.json() as { items?: GlobalSearchIndexItem[] };
    setItems(data.items ?? []);
    setLoaded(true);
  }, [loaded]);

  const clearPendingTimers = useCallback(() => {
    if (pendingNavigationTimerRef.current !== null) {
      window.clearTimeout(pendingNavigationTimerRef.current);
      pendingNavigationTimerRef.current = null;
    }
    if (pendingPollTimerRef.current !== null) {
      window.clearTimeout(pendingPollTimerRef.current);
      pendingPollTimerRef.current = null;
    }
    if (pendingCloseTimerRef.current !== null) {
      window.clearTimeout(pendingCloseTimerRef.current);
      pendingCloseTimerRef.current = null;
    }
    if (pendingFallbackTimerRef.current !== null) {
      window.clearTimeout(pendingFallbackTimerRef.current);
      pendingFallbackTimerRef.current = null;
    }
  }, []);

  const resetPendingResult = useCallback(() => {
    clearPendingTimers();
    setPendingResult(null);
  }, [clearPendingTimers]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    resetPendingResult();
  }, [resetPendingResult]);

  const openSearch = useCallback(() => {
    resetPendingResult();
    setOpen(true);
    void loadIndex();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [loadIndex, resetPendingResult]);

  const closePendingSearchAfterTargetPaint = useCallback(() => {
    if (pendingCloseTimerRef.current !== null) {
      window.clearTimeout(pendingCloseTimerRef.current);
    }
    pendingCloseTimerRef.current = window.setTimeout(() => {
      closeSearch();
    }, 120);
  }, [closeSearch]);

  const waitForPendingSearchTarget = useCallback((href: string) => {
    const checkTarget = () => {
      if (locationMatchesSearchTarget(href)) {
        closePendingSearchAfterTargetPaint();
        return;
      }
      pendingPollTimerRef.current = window.setTimeout(checkTarget, 50);
    };

    checkTarget();
  }, [closePendingSearchAfterTargetPaint]);

  const startPendingSearchNavigation = useCallback((item: GlobalSearchIndexItem, href: string) => {
    clearPendingTimers();
    setPendingResult({ key: globalSearchResultKey(item) });

    pendingFallbackTimerRef.current = window.setTimeout(() => {
      closeSearch();
    }, 3000);

    pendingNavigationTimerRef.current = window.setTimeout(() => {
      if (!pushSamePathUrl(href)) {
        router.push(href);
      }
      waitForPendingSearchTarget(href);
    }, pendingNavigationPaintDelayMs);
  }, [clearPendingTimers, closeSearch, router, waitForPendingSearchTarget]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSearch]);

  useEffect(() => {
    return () => clearPendingTimers();
  }, [clearPendingTimers]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      closeSearch();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.code !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeSearch();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [closeSearch, open]);

  const results = useMemo(() => {
    const text = query.trim();
    if (!text) return [];
    return items
      .map((item) => ({
        item,
        score: globalSearchItemScore(item, text, labels),
      }))
      .filter((entry): entry is { item: GlobalSearchIndexItem; score: number } => entry.score !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return globalSearchTypeOrder.indexOf(a.item.type) - globalSearchTypeOrder.indexOf(b.item.type);
      })
      .map((entry) => entry.item)
      .slice(0, 40);
  }, [items, labels, query]);

  const groupedResults = useMemo(() => {
    const byType = new Map<GlobalSearchIndexItem["type"], GlobalSearchIndexItem[]>();
    for (const item of results) {
      const group = byType.get(item.type);
      if (group) group.push(item);
      else byType.set(item.type, [item]);
    }
    return globalSearchTypeOrder
      .map((type) => ({ type, items: byType.get(type) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  const searchOverlay = open && (
    <div className="fixed inset-0 z-[1000] px-3 pt-16 sm:pt-24">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="relative z-10 mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-white/10 bg-[#111827] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <svg className="h-4 w-4 shrink-0 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.placeholder}
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            inputMode="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="max-h-[min(28rem,calc(100dvh-9rem))] overflow-y-auto p-1.5">
          {!query.trim() && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {copy.empty}
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {copy.noResults}
            </div>
          )}
          {groupedResults.map((group) => {
            const style = globalSearchTypeStyles[group.type];
            return (
              <section key={group.type} className="py-1">
                <div className="flex items-center gap-2 px-2.5 py-1">
                  <span className={`inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-bold ${style.bg} ${style.border} ${style.color}`}>
                    {labels[group.type]}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                {group.items.slice(0, 8).map((item) => {
                  const href = localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale);
                  const resultKey = globalSearchResultKey(item);
                  const isPending = pendingResult?.key === resultKey;
                  const hasPendingResult = pendingResult !== null;
                  return (
                    <a
                      key={resultKey}
                      href={href}
                      onClick={(event) => {
                        if (hasPendingResult) {
                          event.preventDefault();
                          return;
                        }
                        if (!isPlainPrimaryClick(event)) return;
                        event.preventDefault();
                        startPendingSearchNavigation(item, href);
                      }}
                      aria-busy={isPending || undefined}
                      aria-disabled={hasPendingResult || undefined}
                      tabIndex={hasPendingResult && !isPending ? -1 : undefined}
                      data-global-search-pending={isPending ? "true" : undefined}
                      className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
                        isPending
                          ? "bg-white/[0.08] ring-1 ring-yellow-500/25"
                          : hasPendingResult
                            ? "cursor-wait opacity-45"
                            : "hover:bg-white/[0.07]"
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border ${style.bg} ${style.border}`}>
                        <Image
                          src={item.imageUrl ?? style.icon}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 object-contain"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">{item.title}</span>
                        <span className={`block truncate text-xs ${style.color}`}>
                          {labels[item.type]}
                        </span>
                      </span>
                      {isPending && (
                        <GlobalSearchPendingIndicator />
                      )}
                    </a>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-yellow-500/40 hover:bg-white/[0.07] sm:max-w-[18rem] lg:max-w-[22rem]"
        aria-label={copy.placeholder}
      >
        <svg className="h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="min-w-0 flex-1 truncate">{copy.placeholder}</span>
        <kbd className="hidden shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 sm:inline">
          ⌘K
        </kbd>
      </button>

      {portalRoot && createPortal(searchOverlay, portalRoot)}
    </>
  );
}

// --- Main navbar ---

export function SiteNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathGameLocale = getGameLocaleFromPathname(pathname);
  const pathServiceLocale = getServiceLocaleFromPath(pathname);
  const legacyGameLocale = getGameLocaleFromSearch(
    new URLSearchParams(searchParams.toString()),
    pathServiceLocale,
  );
  const gameLocale = searchParams.has("gl") && !hasGameLocalePathPrefix(pathname)
    ? legacyGameLocale
    : pathGameLocale;
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale];
  const profile = useStoredUserProfile();
  const toyBoxItems = getToyBoxNavItems({ serviceLocale, gameLocale });

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <InitialLocaleDetector />
      <LocaleCanonicalizer serviceLocale={serviceLocale} gameLocale={gameLocale} />
      <div className="mx-auto flex h-12 items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href={localizeHrefWithGameLocale("/", serviceLocale, gameLocale)}
            prefetch={false}
            className="flex shrink-0 items-center gap-1 text-sm font-bold text-yellow-500 sm:gap-1.5 sm:text-base"
          >
            <Image
              src="/images/bone_tea.png"
              alt=""
              width={22}
              height={22}
              className="h-[18px] w-[18px] object-contain sm:h-[22px] sm:w-[22px]"
            />
            <span className="max-[560px]:sr-only">{messages.brand}</span>
          </Link>

          <NavIconLink
            href={localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale)}
            icon="/images/sts2/nav/patch_notes_icon.png"
            label={messages.nav.patches}
            iconSize={22}
          />

          <GameDropdown
            icon="/images/sts2/relics/toy_box.webp"
            alt={serviceLocale === "ko" ? "장난감 상자" : "Toy Box"}
            items={toyBoxItems}
            align="left"
            variant="toyBox"
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1">
          <GlobalSearch serviceLocale={serviceLocale} gameLocale={gameLocale} />
          <div className="hidden xl:block">
            <LanguageDropdown value={gameLocale} label={messages.languageSelect} />
          </div>
          <GameDropdown
            icon="/images/sts2/icons/app_icon.png"
            alt={messages.games.sts2Codex}
            items={localizeCodexNavItems(sts2NavItems, serviceLocale, gameLocale, { useGameLabels: true })}
            align="right"
          />
          <GameDropdown
            icon="/images/sts1_app_icon.png"
            alt={messages.games.sts1}
            items={legacySts1NavItems(sts1NavItems, serviceLocale)}
            align="right"
          />
          <NavIconLink
            href={localizeHrefWithGameLocale("/profile", serviceLocale, gameLocale)}
            icon={characterIconUrl(profile.characterId)}
            label={messages.profile.navLabel}
            iconSize={24}
            iconClassName="group-hover:scale-110"
          />
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { NavAttentionDot, type NavAttentionTone } from "@/components/nav-attention-dot";
import { SiteNavDropdown } from "@/components/site-nav-dropdown";
import { GameScrollArea } from "@/components/game-scroll-area";
import Image from "@/components/ui/static-image";
import { useMailboxReply } from "@/hooks/use-mailbox-reply";
import { useNavSeen } from "@/hooks/use-nav-seen";
import { useDevContactInbox } from "@/hooks/use-dev-contact-inbox";
import { useDevPhilosophersNextWeekOpen } from "@/hooks/use-dev-philosophers-next-week";
import { COLORFUL_PHILOSOPHERS_DEV_HREF } from "@/lib/colorful-philosophers";
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
  stripGameLocaleFromPath,
  switchGameLocaleHref,
  withGameLocaleSearch,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getContactHref } from "@/lib/contact-routing";
import { getGameOnlyCompendiumDetailFallbackHref } from "@/lib/compendium-resource-links";
import {
  detectGameLocaleFromNavigator,
  isSearchCrawlerUserAgent,
} from "@/lib/locale-detection";
import {
  globalSearchResultKey,
  globalSearchTypeStyles,
  rankGlobalSearchResults,
  type GlobalSearchIndexItem,
  loadGlobalSearchItems,
} from "@/lib/global-search";
import { ProfileAvatarToken } from "@/components/profile/profile-avatar-token";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import { serviceMessages } from "@/messages/service";
import { contactMessages } from "@/messages/contact";
import { pushCodexHistoryState } from "@/components/codex/use-hydration-safe-search-param";
import {
  getDevNavItems,
  gameOnlyLanguageNavLocales,
  serviceLanguageNavLocales,
} from "@/lib/site-nav-items";
import { SiteTopBar } from "@/components/site-top-bar";
import { attachTopBar } from "@/lib/top-bar-controller";
import { browserStorage, navVisitSearchBonus, readNavVisits } from "@/lib/nav-visits";

import { topBarMenuRows, topBarPatchLinks } from "@/lib/top-bar-menu";

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
  const href = switchGameLocaleHref(pathname, gameLocale, search);
  // Game-only locales have no Compendium detail pages; open the entry on its list.
  return getGameOnlyCompendiumDetailFallbackHref(href) ?? href;
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

export function LanguageSelect({ value, label }: { value: GameLocale; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const option = (locale: GameLocale) => (
    <option key={locale} value={locale}>{GAME_LOCALE_NATIVE_LABELS[locale]}</option>
  );

  return (
    <select
      aria-label={label}
      data-profile-language-select=""
      value={value}
      onChange={(event) => {
        const locale = event.target.value as GameLocale;
        writeLocalePreferenceCookies(locale);
        // Read the query on change: useSearchParams would need a Suspense boundary to prerender /profile.
        router.push(languageHref(pathname, new URLSearchParams(window.location.search), locale));
      }}
      className="h-8 max-w-[11rem] rounded-md border border-border bg-background/80 px-1.5 text-xs font-semibold text-foreground shadow-sm"
    >
      {serviceLanguageNavLocales.map(option)}
      <optgroup label="only game locale">{gameOnlyLanguageNavLocales.map(option)}</optgroup>
    </select>
  );
}

/**
 * The first effect after a document load runs before the metadata boundary
 * hydrates, so a client navigation there leaves the old title, canonical, and
 * hreflang tags in the head for good. That one redirect loads a new document.
 */
function replaceLocaleHref(
  router: ReturnType<typeof useRouter>,
  href: string,
  afterDocumentLoad: boolean,
) {
  if (afterDocumentLoad) window.location.replace(href);
  else router.replace(href);
}

function InitialLocaleDetector() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterDocumentLoad = useRef(true);

  useEffect(() => {
    const targetHref = (() => {
      if (hasGameLocalePathPrefix(pathname)) return null;
      if (searchParams.has("gl")) return null;
      if (getLocalePreference()) return null;
      // Crawlers index the requested language page; never switch it for them.
      if (isSearchCrawlerUserAgent(navigator.userAgent)) return null;

      const detectedGameLocale = detectGameLocaleFromNavigator(navigator);
      const detectedHref = languageHref(
        pathname,
        new URLSearchParams(searchParams.toString()),
        detectedGameLocale,
      );
      const currentSearch = searchParams.toString();
      const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
      return detectedHref === currentHref ? null : detectedHref;
    })();

    if (targetHref) {
      replaceLocaleHref(router, `${targetHref}${window.location.hash}`, afterDocumentLoad.current);
    }
    afterDocumentLoad.current = false;
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
  const afterDocumentLoad = useRef(true);

  useEffect(() => {
    const targetHref = (() => {
      const search = new URLSearchParams(searchParams.toString());
      const legacyGameLocale = searchParams.get("gl");
      if (legacyGameLocale && isGameLocale(legacyGameLocale)) {
        return languageHref(pathname, search, legacyGameLocale);
      }

      if (hasGameLocalePathPrefix(pathname)) return null;

      const savedGameLocale = getLocalePreference();
      if (!savedGameLocale) return null;

      const expectedServiceLocale = getServiceLocaleForGameLocale(savedGameLocale);
      if (gameLocale === savedGameLocale && serviceLocale === expectedServiceLocale) {
        return null;
      }

      return languageHref(pathname, search, savedGameLocale);
    })();

    if (targetHref) {
      replaceLocaleHref(router, `${targetHref}${window.location.hash}`, afterDocumentLoad.current);
    }
    afterDocumentLoad.current = false;
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
  const [loadFailed, setLoadFailed] = useState(false);
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
    try {
      setItems(await loadGlobalSearchItems(serviceLocale, gameLocale));
      setLoaded(true);
      setLoadFailed(false);
    } catch {
      // The next time the search opens tries again.
      setLoadFailed(true);
    }
  }, [gameLocale, loaded, serviceLocale]);

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

  const results = useMemo(
    () => rankGlobalSearchResults(items, query, labels, navVisitSearchBonus(readNavVisits(browserStorage()))),
    [items, labels, query],
  );

  const searchOverlay = open && (
    <div className="fixed inset-0 z-[1000] px-3 pt-16 sm:pt-24">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="relative z-10 mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-border bg-popover shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <svg className="h-4 w-4 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
        <GameScrollArea className="max-h-[min(28rem,calc(100dvh-9rem))]" size="small" scrollerClassName="p-1.5">
          {!query.trim() && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {copy.empty}
            </div>
          )}
          {query.trim() && loadFailed && !loaded && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {copy.loadFailed}
            </div>
          )}
          {query.trim() && loaded && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {copy.noResults}
            </div>
          )}
          {query.trim() && !loaded && !loadFailed && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {copy.loading}
            </div>
          )}
          {results.length > 0 && (
            <div className="py-1">
              {results.map((item) => {
                const style = globalSearchTypeStyles[item.type];
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
                        ? "bg-white/[0.08] ring-1 ring-primary/25"
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
                    </span>
                    <span className={`inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[10px] font-bold ${style.bg} ${style.border} ${style.color}`}>
                      {item.game === "sts1" ? `${copy.sts1Prefix} ` : ""}{labels[item.type]}
                    </span>
                    {isPending && (
                      <GlobalSearchPendingIndicator />
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </GameScrollArea>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/70 sm:max-w-[18rem] lg:max-w-[22rem]"
        aria-label={copy.placeholder}
      >
        <svg className="h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="min-w-0 flex-1 truncate">{copy.placeholder}</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      {portalRoot && createPortal(searchOverlay, portalRoot)}
    </>
  );
}

// --- Main navbar ---

function subscribeNever() {
  return () => {};
}

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
  const contactCopy = contactMessages[serviceLocale];
  const { stored, profile } = useStoredProfileSnapshot();
  const navSeen = useNavSeen(pathname);
  const router = useRouter();
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!headerRef.current) return;
    return attachTopBar(headerRef.current, { navigate: (href) => router.push(href), pathname });
  }, [pathname, router]);
  const placeCopy = messages.placeIndex;
  const languages = [...serviceLanguageNavLocales, ...gameOnlyLanguageNavLocales].map((locale) => ({
    locale,
    href: languageHref(pathname, new URLSearchParams(searchParams.toString()), locale),
    label: GAME_LOCALE_NATIVE_LABELS[locale],
    active: locale === gameLocale,
    gameOnly: !(serviceLanguageNavLocales as readonly GameLocale[]).includes(locale),
  }));
  const rawDevItems = getDevNavItems({ serviceLocale, gameLocale });
  const debateWeekOpen = useDevPhilosophersNextWeekOpen(
    rawDevItems.some((item) => stripGameLocaleFromPath(item.href) === COLORFUL_PHILOSOPHERS_DEV_HREF),
    pathname,
  );
  const devItems = rawDevItems.map((item) => (
    stripGameLocaleFromPath(item.href) === COLORFUL_PHILOSOPHERS_DEV_HREF
      ? { ...item, attention: debateWeekOpen }
      : item
  ));
  const mailboxReply = useMailboxReply();
  const inboxUnchecked = useDevContactInbox(pathname);
  const mailboxTone: NavAttentionTone = inboxUnchecked ? "inbox" : "unread";
  // A record shell is prerendered under a placeholder id and React keeps
  // server attributes on hydration, so the source path waits until the client
  // renders with the real address.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const contactHref = getContactHref(hydrated ? pathname : "/contact", serviceLocale, gameLocale);
  const isContactPage = stripGameLocaleFromPath(pathname) === "/contact";

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <InitialLocaleDetector />
        <LocaleCanonicalizer serviceLocale={serviceLocale} gameLocale={gameLocale} />
        <SiteTopBar
          brand={{ href: localizeHrefWithGameLocale("/", serviceLocale, gameLocale), label: messages.brand }}
          patches={{
            href: localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale),
            label: messages.nav.patches,
            items: topBarPatchLinks(serviceLocale, gameLocale),
            attention: navSeen.patches,
          }}
          menu={{
            label: placeCopy.menu,
            rows: topBarMenuRows(serviceLocale, gameLocale),
            newLabel: placeCopy.newLabel,
            moreLabel: placeCopy.more,
            allHref: localizeHrefWithGameLocale("/menu", serviceLocale, gameLocale),
            allLabel: placeCopy.menuTitle,
            attention: navSeen.toyBox,
          }}
          unreadIds={navSeen.unreadIds}
          search={<GlobalSearch key={gameLocale} serviceLocale={serviceLocale} gameLocale={gameLocale} />}
          profile={{
            href: localizeHrefWithGameLocale("/profile", serviceLocale, gameLocale),
            label: messages.profile.navLabel,
            icon: (
              <ProfileAvatarToken
                profile={profile}
                stored={stored}
                size={24}
                className="h-[18px] w-[18px] object-contain brightness-90 transition-all hover:brightness-110 sm:h-6 sm:w-6"
              />
            ),
            languageLabel: messages.languageSelect,
            languages,
          }}
          dev={devItems.length > 0 ? (
            <SiteNavDropdown
              icon="/images/sts2/nav/question_mark.png"
              alt="Dev"
              items={devItems}
              align="left"
              layout="grid"
              attention={debateWeekOpen}
            />
          ) : undefined}
        />
      </header>

      {!isContactPage && (
        <Link
          href={contactHref}
          prefetch={false}
          aria-label={contactCopy.navLabel}
          data-contact-launcher="floating"
          className="group fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-[border-color,background-color,transform] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transform-none"
        >
          <span className="relative inline-flex h-8 w-8 items-center justify-center">
            <Image
              src="/images/sts2/relics/tiny_mailbox.webp"
              alt=""
              width={34}
              height={34}
              className="h-full w-full object-contain drop-shadow-md transition-transform group-hover:scale-110"
            />
            {(mailboxReply || inboxUnchecked) && <NavAttentionDot tone={mailboxTone} />}
          </span>
          <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-bold text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {contactCopy.navLabel}
          </span>
        </Link>
      )}
    </>
  );
}

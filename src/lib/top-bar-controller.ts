import registryPayload from "@/data/place-registry.json";
import { getServiceLocaleForGameLocale, GAME_LOCALE_COOKIE, isGameLocale, LOCALE_COOKIE_MAX_AGE, SERVICE_LOCALE_COOKIE } from "@/lib/i18n";
import { browserStorage, readNavVisits, recordNavVisit, sortNavMenuEntries } from "@/lib/nav-visits";

// Behavior for SiteTopBar's markup, shared by the main app (React effect) and the
// static patch pages (an esbuild client bundle). It only reads and sets attributes
// React does not render, so React re-renders never undo it.

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 300;
const PHONE_QUERY = "(max-width: 639px)";
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const PHONE_VISIBLE_ITEMS = 3;
const SHEET_STATE_KEY = "topBarSheet";

const PLACES: readonly { id: string; href: string }[] = registryPayload.places;


function writeLocalePreferenceCookies(value: string) {
  if (!isGameLocale(value)) return;
  const suffix = `Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  document.cookie = `${SERVICE_LOCALE_COOKIE}=${getServiceLocaleForGameLocale(value)}; ${suffix}`;
  document.cookie = `${GAME_LOCALE_COOKIE}=${value}; ${suffix}`;
}

/** Orders a menu row and keeps only what fits on one line; the rest is "+N". */
export function layoutMenuRow(row: HTMLElement, visits = readNavVisits(browserStorage())): void {
  const list = row.querySelector<HTMLElement>("[data-menu-items]");
  const more = row.querySelector<HTMLElement>("[data-menu-more]");
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLElement>("[data-menu-item]")];
  const sorted = sortNavMenuEntries(items.map((element) => ({
    element,
    id: element.dataset.menuItem ?? "",
    order: Number(element.dataset.order ?? 0),
    fold: element.dataset.fold === "true",
    isNew: element.dataset.new === "true",
    unread: Boolean(element.querySelector("[data-nav-attention]:not([hidden])")),
  })), visits);

  sorted.forEach((entry, index) => {
    entry.element.style.order = String(index);
    entry.element.removeAttribute("data-overflow");
  });

  let visible = sorted.length;
  if (window.matchMedia(PHONE_QUERY).matches) {
    visible = Math.min(sorted.length, PHONE_VISIBLE_ITEMS);
  } else {
    const first = sorted[0]?.element;
    const itemWidth = first ? first.getBoundingClientRect().width : 0;
    const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
    const width = list.getBoundingClientRect().width;
    if (itemWidth > 0 && width > 0) {
      const fit = Math.max(1, Math.floor((width + gap) / (itemWidth + gap)));
      // Leave one slot for "+N" when not everything fits.
      visible = fit >= sorted.length ? sorted.length : Math.max(1, fit - 1);
    }
  }
  sorted.forEach((entry, index) => {
    if (index >= visible) entry.element.setAttribute("data-overflow", "true");
  });

  if (more) {
    const hidden = sorted.length - visible;
    more.hidden = hidden === 0;
    const count = more.querySelector<HTMLElement>("[data-menu-more-count]");
    if (count) count.textContent = (more.dataset.label ?? "+{count}").replace("{count}", String(hidden));
  }
}

/**
 * Hover opens a top bar popover on a mouse; a click on its button goes to the
 * button's page. Touch toggles; the phone menu sheet closes on Back.
 */
export function attachTopBar(
  root: HTMLElement,
  options: { navigate?: (href: string) => void; pathname?: string } = {},
): () => void {
  const navigate = options.navigate ?? ((href: string) => window.location.assign(href));
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window | Document,
    type: K | string,
    handler: (event: Event) => void,
  ) => {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  };

  recordNavVisit(browserStorage(), options.pathname ?? window.location.pathname, PLACES);

  const popovers = [...root.querySelectorAll<HTMLDetailsElement>("details[data-top-bar-popover]")];
  const finePointer = () => window.matchMedia(FINE_POINTER_QUERY).matches;

  for (const details of popovers) {
    const summary = details.querySelector<HTMLElement>(":scope > summary");
    const href = details.dataset.href;
    let timer: number | undefined;
    const schedule = (open: boolean, delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (open) details.setAttribute("open", "");
        else details.removeAttribute("open");
      }, delay);
    };
    cleanups.push(() => window.clearTimeout(timer));

    on(details, "mouseenter", () => {
      if (finePointer()) schedule(true, OPEN_DELAY_MS);
    });
    on(details, "mouseleave", () => {
      if (finePointer()) schedule(false, CLOSE_DELAY_MS);
    });

    if (summary) {
      on(summary, "click", (event) => {
        // On a mouse the popover already opened on hover, so a click means "go there".
        if (href && finePointer()) {
          event.preventDefault();
          navigate(href);
        }
      });
      on(summary, "keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "ArrowDown") {
          event.preventDefault();
          details.setAttribute("open", "");
          details.querySelector<HTMLElement>("[role=menu] a")?.focus();
        } else if (key === "Enter" && href) {
          event.preventDefault();
          navigate(href);
        }
      });
    }

    on(details, "toggle", () => {
      // Set by a link or Back that already moved history; toggle fires after them.
      const leaving = details.dataset.leaving === "true";
      delete details.dataset.leaving;
      if (details.open) {
        for (const other of popovers) if (other !== details) other.removeAttribute("open");
        details.querySelectorAll<HTMLElement>("[data-menu-row]").forEach((row) => layoutMenuRow(row));
      }
      if (details.dataset.topBarPopover !== "menu" || !window.matchMedia(PHONE_QUERY).matches) return;
      // Back closes the phone sheet instead of leaving the page.
      if (details.open && !window.history.state?.[SHEET_STATE_KEY]) {
        window.history.pushState({ ...window.history.state, [SHEET_STATE_KEY]: true }, "");
      } else if (!details.open && !leaving && window.history.state?.[SHEET_STATE_KEY]) {
        window.history.back();
      }
    });

    on(details, "click", (event) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const locale = link.dataset.localePref;
      if (locale) writeLocalePreferenceCookies(locale);
      // A link inside the sheet leaves the page; keep its history entry as is.
      details.dataset.leaving = "true";
      details.removeAttribute("open");
    });
  }

  on(document, "pointerdown", (event) => {
    for (const details of popovers) {
      if (details.open && !details.contains(event.target as Node)) details.removeAttribute("open");
    }
  });
  on(document, "keydown", (event) => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    for (const details of popovers) details.removeAttribute("open");
  });

  on(window, "popstate", () => {
    for (const details of popovers) {
      if (details.dataset.topBarPopover === "menu" && details.open) {
        details.dataset.leaving = "true";
        details.removeAttribute("open");
      }
    }
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}

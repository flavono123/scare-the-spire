import { gameLocaleFromPathSegment, type GameLocale } from "../src/lib/i18n";

interface HTMLRewriterElement {
  setAttribute(name: string, value: string): void;
}

interface HTMLRewriterInstance {
  on(
    selector: string,
    handlers: {
      element?(element: HTMLRewriterElement): void;
    },
  ): HTMLRewriterInstance;
  transform(response: Response): Response;
}

declare const HTMLRewriter: {
  new (): HTMLRewriterInstance;
};

/** Game locale for a locale-prefixed path; null for prefixless Korean paths. */
export function documentGameLocaleForPath(pathname: string): GameLocale | null {
  const gameLocale = gameLocaleFromPathSegment(pathname.split("/").filter(Boolean)[0]);
  return gameLocale && gameLocale !== "kor" ? gameLocale : null;
}

/**
 * The shared root layout renders <html lang="ko">. Static locale pages are fixed
 * at copy time (scripts/copy-cf-static-pages.mjs); this covers locale-prefixed
 * documents rendered by OpenNext, which all use the English service UI.
 */
export function withLocalizedDocumentRoot(response: Response, pathname: string): Response {
  const gameLocale = documentGameLocaleForPath(pathname);
  if (!gameLocale || !response.body) return response;
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("html", {
      element(element) {
        element.setAttribute("lang", "en");
        element.setAttribute("data-service-locale", "en");
        element.setAttribute("data-game-locale", gameLocale);
      },
    })
    .transform(response);
}

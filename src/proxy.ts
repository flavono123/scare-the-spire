import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  GAME_LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  SERVICE_LOCALE_COOKIE,
  getServiceLocaleForGameLocale,
  isGameLocale,
  isServiceLocale,
  stripServiceLocaleFromPath,
  withGameLocaleSearch,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { detectGameLocaleFromHeaders } from "@/lib/locale-detection";

function shouldHandleRequest(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.get("purpose") === "prefetch") return false;
  if (request.headers.has("next-router-prefetch")) return false;
  if (request.headers.has("x-middleware-prefetch")) return false;

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

function isProductionBlockedDevRoute(pathname: string): boolean {
  if (process.env.NODE_ENV !== "production") return false;

  const unprefixedPath = stripServiceLocaleFromPath(pathname);
  return unprefixedPath === "/dev" || unprefixedPath.startsWith("/dev/");
}

function localeUrl(
  request: NextRequest,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): URL {
  const url = request.nextUrl.clone();
  const unprefixedPath = stripServiceLocaleFromPath(url.pathname);
  url.pathname = serviceLocale === "en"
    ? unprefixedPath === "/" ? "/en" : `/en${unprefixedPath}`
    : unprefixedPath;

  const searchParams = new URLSearchParams(url.searchParams);
  url.search = withGameLocaleSearch(searchParams, gameLocale, serviceLocale);
  return url;
}

function setLocaleCookies(
  response: NextResponse,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): NextResponse {
  const cookieOptions = {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
  };

  response.cookies.set(SERVICE_LOCALE_COOKIE, serviceLocale, cookieOptions);
  response.cookies.set(GAME_LOCALE_COOKIE, gameLocale, cookieOptions);
  return response;
}

function respondWithLocale(
  request: NextRequest,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
  options: { persist?: boolean } = {},
): NextResponse {
  const targetUrl = localeUrl(request, serviceLocale, gameLocale);
  const currentPath = request.nextUrl.pathname;
  const currentSearch = request.nextUrl.search;
  const response = targetUrl.pathname !== currentPath || targetUrl.search !== currentSearch
    ? NextResponse.redirect(targetUrl)
    : NextResponse.next();

  return options.persist ? setLocaleCookies(response, serviceLocale, gameLocale) : response;
}

function cookieGameLocale(request: NextRequest): GameLocale | null {
  const cookieValue = request.cookies.get(GAME_LOCALE_COOKIE)?.value;
  return cookieValue && isGameLocale(cookieValue) ? cookieValue : null;
}

function cookieServiceLocale(request: NextRequest): ServiceLocale | null {
  const cookieValue = request.cookies.get(SERVICE_LOCALE_COOKIE)?.value;
  return cookieValue && isServiceLocale(cookieValue) ? cookieValue : null;
}

export function proxy(request: NextRequest) {
  if (!shouldHandleRequest(request)) return NextResponse.next();

  if (isProductionBlockedDevRoute(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const savedGameLocale = cookieGameLocale(request);
  if (savedGameLocale) {
    return respondWithLocale(
      request,
      getServiceLocaleForGameLocale(savedGameLocale),
      savedGameLocale,
      { persist: true },
    );
  }

  const savedServiceLocale = cookieServiceLocale(request);
  if (savedServiceLocale) {
    return respondWithLocale(
      request,
      savedServiceLocale,
      DEFAULT_GAME_LOCALE_BY_SERVICE[savedServiceLocale],
      { persist: true },
    );
  }

  const detectedGameLocale = detectGameLocaleFromHeaders(request.headers);
  return respondWithLocale(
    request,
    getServiceLocaleForGameLocale(detectedGameLocale),
    detectedGameLocale,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|robots.txt|site.webmanifest|images|fonts|slack-emoji|comment-entities).*)",
  ],
};

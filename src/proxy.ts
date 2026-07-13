import { type NextRequest, NextResponse } from "next/server";
import {
  buildMigrationDestination,
  shouldRedirectLegacyPage,
} from "./lib/vercel-deprecation";

const LOCAL_TEST_HEADER = "x-vercel-deprecation-local-test";
const LOCAL_TEST_TARGET_HEADER = "x-vercel-deprecation-local-target-origin";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function localTestTargetOrigin(request: NextRequest): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (!LOCAL_HOSTNAMES.has(request.nextUrl.hostname)) return null;
  if (request.headers.get(LOCAL_TEST_HEADER) !== "1") return null;

  const configuredTarget = request.headers.get(LOCAL_TEST_TARGET_HEADER);
  if (!configuredTarget) return null;

  try {
    return new URL(configuredTarget).origin;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const localTargetOrigin = localTestTargetOrigin(request);
  if (
    !shouldRedirectLegacyPage({
      hostname: request.nextUrl.hostname,
      ...(localTargetOrigin ? { localTestMode: true } : {}),
      method: request.method,
      pathname: request.nextUrl.pathname,
    })
  ) {
    return NextResponse.next();
  }

  return NextResponse.redirect(
    buildMigrationDestination(
      request.nextUrl.pathname,
      request.nextUrl.search,
      localTargetOrigin ?? undefined,
    ),
    308,
  );
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_patches|_vercel|fonts|images|spine|generated|comment-entities|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

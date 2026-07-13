import { type NextRequest, NextResponse } from "next/server";
import {
  buildMigrationDestination,
  shouldRedirectLegacyPage,
} from "./lib/vercel-deprecation";

export function proxy(request: NextRequest) {
  if (
    !shouldRedirectLegacyPage({
      hostname: request.nextUrl.hostname,
      method: request.method,
      pathname: request.nextUrl.pathname,
    })
  ) {
    return NextResponse.next();
  }

  return NextResponse.redirect(
    buildMigrationDestination(request.nextUrl.pathname, request.nextUrl.search),
    308,
  );
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_patches|_vercel|fonts|images|spine|generated|comment-entities|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

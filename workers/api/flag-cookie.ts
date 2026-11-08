import {
  FLAG_COOKIE_NAME,
  flagCookieValue,
  isApiSurfaceGroup,
  parseFlagCookieValue,
  QA_COOKIE_NAME,
  QA_NO_SUPABASE,
  QA_PATH_COOKIE_NAME,
  type ApiSurfaceGroup,
} from "../../src/lib/api-surfaces";
import { IDENTITY_MODE_COOKIE_NAME } from "../../src/lib/identity-cookies";
import { flagsDisabledReason, pageFlags, type ExecutionContextLike, type FlagsEnv } from "./flags";
import { identityModeCookieHeader, type IdentityEnv } from "./identity/cookie";
import { pageIdentityMode } from "./identity/mode";
import { supabaseApiConfig } from "./supabase-rest";

/**
 * Tells the browser which groups use the api path through the `slseoun_rf`
 * cookie (docs/supabase-exit/STEP1_DESIGN.md 3.3). Bodies, ETags and
 * Cache-Control stay untouched, so HTML is byte-identical and 304s still work.
 */

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

/**
 * Paths that are files, never pages. Like the patch Worker's isFilePath, except
 * an extension must start with a letter: patch versions (/patches/0.107.1) are pages.
 */
export function isFilePath(pathname: string): boolean {
  return (
    pathname.startsWith("/_patches/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/fonts/") ||
    /\.[a-z][a-z0-9]{0,7}$/i.test(pathname)
  );
}

/** Requests whose responses may carry the flag cookie. Decided by path, never by Accept. */
export function isPageRequest(request: Request, url: URL): boolean {
  return (
    (request.method === "GET" || request.method === "HEAD")
    && !url.pathname.startsWith("/api/")
    && !isFilePath(url.pathname)
  );
}

export type QaOverride = { noSupabase: boolean; forcedGroups: Set<ApiSurfaceGroup> | null };

/**
 * QA cookies (3.4): `slseoun_qa=no-supabase` keeps the request off Supabase
 * everywhere; `slseoun_qa_path=nav.comments` pins groups to api, honored only
 * with development data so production users cannot be pinned.
 */
export function qaOverride(request: Request, env: FlagsEnv): QaOverride {
  const noSupabase = readCookie(request, QA_COOKIE_NAME) === QA_NO_SUPABASE;
  let forcedGroups: Set<ApiSurfaceGroup> | null = null;
  const pinned = readCookie(request, QA_PATH_COOKIE_NAME);
  if (pinned !== null && supabaseApiConfig(env)?.dataEnv === "development") {
    forcedGroups = new Set(pinned.split(".").filter(isApiSurfaceGroup));
  }
  return { noSupabase, forcedGroups };
}

function intersect(groups: Iterable<ApiSurfaceGroup>, routed: ReadonlySet<ApiSurfaceGroup>): Set<ApiSurfaceGroup> {
  return new Set([...groups].filter((group) => routed.has(group)));
}

/** Effective groups for a page request, or null when unknown (leave the cookie alone). */
export function effectivePageGroups(
  request: Request,
  env: FlagsEnv,
  ctx: ExecutionContextLike,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  now = Date.now(),
): ReadonlySet<ApiSurfaceGroup> | null {
  // The kill switch (off, bad config) wins over QA pins.
  if (flagsDisabledReason(env)) return new Set();
  const qa = qaOverride(request, env);
  if (qa.noSupabase) return new Set();
  if (qa.forcedGroups) return intersect(qa.forcedGroups, routedGroups);
  return pageFlags(env, ctx, routedGroups, now);
}

/** `Set-Cookie` value for the wanted groups given what the request carried, or null for no change. */
export function flagCookieHeader(
  current: string | null,
  groups: ReadonlySet<ApiSurfaceGroup>,
  secure: boolean,
): string | null {
  const wanted = flagCookieValue(groups);
  const currentGroups = current === null ? null : parseFlagCookieValue(current);
  if (wanted === null) {
    return current === null ? null : `${FLAG_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`;
  }
  if (current === wanted && currentGroups) return null;
  return `${FLAG_COOKIE_NAME}=${wanted}; Path=/; Max-Age=86400; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * Adds the flag cookie to a page response. `response` must be a mutable copy
 * (withSecurityHeaders makes one); service binding and redirect headers are immutable.
 */
export function withFlagCookie(
  request: Request,
  url: URL,
  env: FlagsEnv & IdentityEnv,
  ctx: ExecutionContextLike,
  routedGroups: ReadonlySet<ApiSurfaceGroup>,
  response: Response,
): Response {
  if (!isPageRequest(request, url)) return response;
  const groups = effectivePageGroups(request, env, ctx, routedGroups);
  // Step 4 identity mode signal (slseoun_idm); token mode with no cookie adds nothing.
  const identityMode = pageIdentityMode(env, qaOverride(request, env).noSupabase);
  const identitySignal = identityMode === null
    ? null
    : identityModeCookieHeader(readCookie(request, IDENTITY_MODE_COOKIE_NAME), identityMode, url.protocol === "https:");
  if (identitySignal) response.headers.append("Set-Cookie", identitySignal);
  if (groups === null) return response;
  const header = flagCookieHeader(readCookie(request, FLAG_COOKIE_NAME), groups, url.protocol === "https:");
  if (header) response.headers.append("Set-Cookie", header);
  return response;
}

"use client";

import { useEffect, useState } from "react";
import {
  effectiveUnreadIds,
  fetchUnreadSurfaceIds,
  publishNavSeen,
  readNavForce,
  readNavSeen,
  readUnreadCache,
  seenStamp,
  NAV_SEEN_SURFACES,
  surfaceIdForPath,
  topBarPatchUnread,
  toyBoxHasUnread,
  writeNavForce,
  writeNavSeen,
  writeUnreadCache,
  type NavForceMap,
  NAV_SEEN_EVENT,
  type NavSeenMap,
} from "@/lib/nav-seen";
import { stripGameLocaleFromPath } from "@/lib/i18n";

export function useNavSeen(pathname: string): { unreadIds: string[]; toyBox: boolean; patches: boolean } {
  const [unreadIds, setUnreadIds] = useState<string[]>([]);

  useEffect(() => {
    const surfaceId = surfaceIdForPath(pathname);
    const surface = NAV_SEEN_SURFACES.find((item) => item.id === surfaceId);
    const path = stripGameLocaleFromPath(pathname);
    const onIndex = Boolean(surface && path === surface.href);
    if (surfaceId && !onIndex) {
      const seen = readNavSeen(window.localStorage);
      seen[surfaceId] = new Date().toISOString();
      writeNavSeen(window.localStorage, seen);
    }

    let cancelled = false;
    const apply = (ids: readonly string[]) => {
      if (!cancelled) setUnreadIds(effectiveUnreadIds(ids, readNavForce(window.localStorage)));
    };

    const load = () => {
      const seen = readNavSeen(window.localStorage);
      const stamp = seenStamp(seen);
      const cached = readUnreadCache(window.sessionStorage, stamp);
      if (cached) {
        const visible = surfaceId ? cached.filter((id) => id !== surfaceId) : cached;
        apply(visible);
        return;
      }
      void fetchUnreadSurfaceIds(seen).then((ids) => {
        const visible = surfaceId ? ids.filter((id) => id !== surfaceId) : ids;
        writeUnreadCache(window.sessionStorage, stamp, visible);
        apply(visible);
      });
    };

    load();
    window.addEventListener(NAV_SEEN_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(NAV_SEEN_EVENT, load);
    };
  }, [pathname]);

  return {
    unreadIds,
    toyBox: toyBoxHasUnread(unreadIds),
    patches: topBarPatchUnread(unreadIds),
  };
}

export function replaceNavSeen(next: NavSeenMap): void {
  writeNavSeen(window.localStorage, next);
  publishNavSeen();
}

export function replaceNavForce(next: NavForceMap): void {
  writeNavForce(window.localStorage, next);
  publishNavSeen();
}

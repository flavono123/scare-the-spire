"use client";

import { useEffect, useState } from "react";
import {
  displayedUnreadIds,
  fetchUnreadSurfaceIds,
  publishNavSeen,
  readNavSeen,
  readUnreadCache,
  seenStamp,
  surfaceIdForPath,
  toyBoxHasUnread,
  writeNavSeen,
  writeUnreadCache,
  NAV_SEEN_EVENT,
  type NavSeenMap,
} from "@/lib/nav-seen";

export function useNavSeen(pathname: string): { unreadIds: string[]; toyBox: boolean; patches: boolean } {
  const [unreadIds, setUnreadIds] = useState<string[]>([]);

  useEffect(() => {
    const surfaceId = surfaceIdForPath(pathname);
    if (surfaceId) {
      const seen = readNavSeen(window.localStorage);
      seen[surfaceId] = new Date().toISOString();
      writeNavSeen(window.localStorage, seen);
    }

    let cancelled = false;
    const apply = (ids: readonly string[]) => {
      if (!cancelled) setUnreadIds(displayedUnreadIds(ids));
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
    patches: unreadIds.includes("patches"),
  };
}

export function replaceNavSeen(next: NavSeenMap): void {
  writeNavSeen(window.localStorage, next);
  publishNavSeen();
}

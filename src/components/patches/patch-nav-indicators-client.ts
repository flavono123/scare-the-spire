import { stripGameLocaleFromPath } from "@/lib/i18n";
import {
  effectiveUnreadIds,
  fetchUnreadSurfaceIds,
  NAV_SEEN_EVENT,
  readNavForce,
  readNavSeen,
  NAV_SEEN_SURFACES,
  surfaceIdForPath,
  topBarPatchUnread,
  toyBoxHasUnread,
  writeNavSeen,
} from "@/lib/nav-seen";

function applyUnread(ids: readonly string[]) {
  const shown = new Set(effectiveUnreadIds(ids, readNavForce(window.localStorage)));
  document.querySelectorAll<HTMLElement>("[data-nav-attention]").forEach((node) => {
    const name = node.getAttribute("data-nav-attention");
    const on = name === "toy-box"
      ? toyBoxHasUnread([...shown])
      : name === "patches"
        ? topBarPatchUnread([...shown])
        : Boolean(name && shown.has(name));
    node.hidden = !on;
  });
}

function sync() {
  const surfaceId = surfaceIdForPath(window.location.pathname);
  const surface = NAV_SEEN_SURFACES.find((item) => item.id === surfaceId);
  const path = stripGameLocaleFromPath(window.location.pathname);
  const onIndex = Boolean(surface && path === surface.href);
  if (surfaceId && !onIndex) {
    const seen = readNavSeen(window.localStorage);
    seen[surfaceId] = new Date().toISOString();
    writeNavSeen(window.localStorage, seen);
  }
  const seen = readNavSeen(window.localStorage);
  void fetchUnreadSurfaceIds(seen).then((ids) => {
    applyUnread(surfaceId ? ids.filter((id) => id !== surfaceId) : ids);
  });
}

sync();
window.addEventListener(NAV_SEEN_EVENT, sync);

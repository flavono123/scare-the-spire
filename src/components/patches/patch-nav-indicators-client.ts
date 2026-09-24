import {
  effectiveUnreadIds,
  fetchUnreadSurfaceIds,
  NAV_SEEN_EVENT,
  readNavForce,
  readNavSeen,
  surfaceIdForPath,
  toyBoxHasUnread,
  writeNavSeen,
} from "@/lib/nav-seen";

function applyUnread(ids: readonly string[]) {
  const shown = new Set(effectiveUnreadIds(ids, readNavForce(window.localStorage)));
  document.querySelectorAll<HTMLElement>("[data-nav-attention]").forEach((node) => {
    const name = node.getAttribute("data-nav-attention");
    const on = name === "toy-box" ? toyBoxHasUnread([...shown]) : Boolean(name && shown.has(name));
    node.hidden = !on;
  });
}

function sync() {
  const surfaceId = surfaceIdForPath(window.location.pathname);
  if (surfaceId) {
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

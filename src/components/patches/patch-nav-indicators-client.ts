import {
  effectiveUnreadIds,
  fetchUnreadSurfaceIds,
  markNavVisit,
  NAV_SEEN_EVENT,
  readMenuUnreadSince,
  readNavForce,
  topBarPatchUnread,
  toyBoxHasUnread,
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
  const surfaceId = markNavVisit(window.localStorage, window.location.pathname);
  void fetchUnreadSurfaceIds(readMenuUnreadSince(window.localStorage)).then((ids) => {
    applyUnread(surfaceId ? ids.filter((id) => id !== surfaceId) : ids);
  });
}

sync();
window.addEventListener(NAV_SEEN_EVENT, sync);

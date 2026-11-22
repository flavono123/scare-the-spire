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
import { attachTopBar, layoutMenuRow } from "@/lib/top-bar-controller";

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
  // New-post dots move items forward in an open menu.
  document.querySelectorAll<HTMLElement>("details[open] [data-menu-row]").forEach((row) => layoutMenuRow(row));
}

function sync() {
  const surfaceId = markNavVisit(window.localStorage, window.location.pathname);
  void fetchUnreadSurfaceIds(readMenuUnreadSince(window.localStorage)).then((ids) => {
    applyUnread(surfaceId ? ids.filter((id) => id !== surfaceId) : ids);
  });
}

const topBar = document.querySelector<HTMLElement>("[data-top-bar]");
if (topBar) attachTopBar(topBar);
sync();
window.addEventListener(NAV_SEEN_EVENT, sync);

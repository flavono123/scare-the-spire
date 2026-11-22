"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useNavSeen } from "@/hooks/use-nav-seen";

/** Shows the yellow new-post dots that index tiles render dormant. */
export function NavAttentionMarkers() {
  const pathname = usePathname();
  const { unreadIds } = useNavSeen(pathname ?? "/");
  useEffect(() => {
    const unread = new Set(unreadIds);
    for (const dot of document.querySelectorAll<HTMLElement>("[data-nav-attention]")) {
      if (!dot.closest("[data-place-index]")) continue;
      dot.hidden = !unread.has(dot.dataset.navAttention ?? "");
    }
  }, [unreadIds]);
  return null;
}

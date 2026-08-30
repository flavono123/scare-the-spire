"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { usePathname } from "next/navigation";

function emptySubscribe() {
  return () => {};
}

function lastPathSegment(pathname: string): string {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  return parts.at(-1) ?? "";
}

function syncCanonicalFromLocation() {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hash = "";
  canonicalUrl.search = "";
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", canonicalUrl.toString());
}

export function StaticDetailShell({
  children,
  idProp = "postId",
}: {
  children: ReactElement;
  idProp?: string;
}) {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const recordId = hydrated ? lastPathSegment(pathname) : null;

  useEffect(() => {
    if (!recordId) return;
    syncCanonicalFromLocation();
  }, [recordId]);

  if (!recordId) {
    return (
      <div
        aria-busy="true"
        data-static-detail-shell="pending"
        className="min-h-48"
      />
    );
  }

  if (!isValidElement(children)) return children;

  return cloneElement(children, { [idProp]: recordId } as never);
}

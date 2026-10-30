"use client";

import {
  cloneElement,
  isValidElement,
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

export function StaticDetailShell({
  children,
  idProp = "postId",
}: {
  children: ReactElement;
  idProp?: string;
}) {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  // The record's canonical, hreflang, and og:url come from the worker
  // (workers/detail-shell-og.ts), so the client leaves the head alone.
  const recordId = hydrated ? lastPathSegment(pathname) : null;

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

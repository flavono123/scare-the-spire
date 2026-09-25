"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { NAV_SEEN_EVENT, contentIsNewerThanSeen, readNavSeen } from "@/lib/nav-seen";
import { cn } from "@/lib/utils";

const fallbackSeenAt = new Map<string, string>();

function subscribeNavSeen(onChange: () => void) {
  window.addEventListener(NAV_SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(NAV_SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function seenSnapshot(surfaceId: string): string {
  const stored = readNavSeen(window.localStorage)[surfaceId];
  if (stored) return stored;
  const existing = fallbackSeenAt.get(surfaceId);
  if (existing) return existing;
  const now = new Date().toISOString();
  fallbackSeenAt.set(surfaceId, now);
  return now;
}

export function useIndexSeenAt(surfaceId: string): string | null {
  return useSyncExternalStore(
    subscribeNavSeen,
    () => seenSnapshot(surfaceId),
    () => null,
  );
}

export function indexItemIsRead(publishedAt: string, seenAt: string | null): boolean {
  if (!seenAt) return false;
  return !contentIsNewerThanSeen(publishedAt, seenAt);
}

export function indexReadClass(read: boolean): string {
  return read ? "spire-purple nav-title-read" : "";
}

export function IndexReadFrame({
  surfaceId,
  publishedAt,
  children,
  className,
}: {
  surfaceId: string;
  publishedAt: string;
  className?: string;
  children: ReactNode;
}) {
  const seenAt = useIndexSeenAt(surfaceId);
  const read = indexItemIsRead(publishedAt, seenAt);
  return <span className={cn(className, read && "spire-purple nav-title-read")}>{children}</span>;
}

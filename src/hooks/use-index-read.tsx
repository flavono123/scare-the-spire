"use client";

import { useEffect, useState, type ReactNode } from "react";
import { contentIsNewerThanSeen, readNavSeen } from "@/lib/nav-seen";
import { cn } from "@/lib/utils";

export function useIndexSeenAt(surfaceId: string): string | null {
  const [seenAt, setSeenAt] = useState<string | null>(null);

  useEffect(() => {
    setSeenAt(readNavSeen(window.localStorage)[surfaceId] ?? new Date().toISOString());
  }, [surfaceId]);

  return seenAt;
}

export function indexItemIsRead(publishedAt: string, seenAt: string | null): boolean {
  if (!seenAt) return false;
  return !contentIsNewerThanSeen(publishedAt, seenAt);
}

export function indexReadClass(read: boolean): string {
  return read ? "nav-index-read" : "";
}

export function IndexReadFrame({
  surfaceId,
  publishedAt,
  children,
}: {
  surfaceId: string;
  publishedAt: string;
  children: ReactNode;
}) {
  const seenAt = useIndexSeenAt(surfaceId);
  const read = indexItemIsRead(publishedAt, seenAt);
  return <div className={cn(read && "nav-index-read")}>{children}</div>;
}

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
  return read ? "spire-read" : "";
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
  return <span className={cn(className, read && "spire-read")}>{children}</span>;
}

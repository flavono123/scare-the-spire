"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "@/components/ui/static-image";
import {
  isByrdispatchMigrationNoticeText,
  isByrdispatchMigrationTargetHost,
  isConfiguredByrdispatchMigrationTargetHost,
  BYRDISPATCH_LATEST_NOTICE_PATH,
  BYRDISPATCH_NOTICE_ICON,
  type ByrdispatchNotice,
} from "@/lib/byrdispatch-static";

function isByrdispatchNoticePage(pathname: string | null): boolean {
  const normalized = (pathname ?? "/").replace(/\/+$/, "") || "/";
  return /(^|\/)byrdispatch$/.test(normalized);
}

function isCurrentByrdispatchMigrationTargetHost(): boolean {
  if (isConfiguredByrdispatchMigrationTargetHost()) return true;
  if (typeof window === "undefined") return false;
  return isByrdispatchMigrationTargetHost(window.location.hostname);
}

function isByrdispatchNotice(value: unknown): value is ByrdispatchNotice {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ByrdispatchNotice>;
  return typeof candidate.date === "string" && typeof candidate.text === "string";
}

export function ByrdispatchFloatingNoticeClient() {
  const pathname = usePathname();
  const isNoticePage = isByrdispatchNoticePage(pathname);
  const isMigrationTargetHost = isCurrentByrdispatchMigrationTargetHost();
  const [noticeText, setNoticeText] = useState<string | null>(null);

  useEffect(() => {
    if (isNoticePage) return;

    let ignore = false;

    fetch(BYRDISPATCH_LATEST_NOTICE_PATH, { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((notice) => {
        if (
          !ignore
          && isByrdispatchNotice(notice)
          && !(isMigrationTargetHost && isByrdispatchMigrationNoticeText(notice.text))
        ) {
          setNoticeText(notice.text);
        }
      })
      .catch(() => {
        if (!ignore) setNoticeText(null);
      });

    return () => {
      ignore = true;
    };
  }, [isNoticePage, isMigrationTargetHost]);

  if (isNoticePage || !noticeText) return null;

  return (
    <aside className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-3 sm:bottom-5">
      <Link
        href="/byrdispatch"
        className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2 border border-pink-300/45 bg-pink-500/20 px-3 py-2 text-pink-50 shadow-[0_0_24px_rgba(244,114,182,0.18)] backdrop-blur transition-colors hover:border-pink-200/70 hover:bg-pink-500/25"
        aria-label="섀소식 공지 보기"
      >
        <Image
          src={BYRDISPATCH_NOTICE_ICON}
          alt=""
          width={22}
          height={22}
          className="h-5 w-5 shrink-0 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]"
        />
        <span className="shrink-0 text-xs font-black text-pink-100 sm:text-sm">
          공지:
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">
          {noticeText}
        </span>
        <span className="shrink-0 text-xs font-black text-pink-100 underline decoration-pink-200/45 underline-offset-4">
          섀소식
        </span>
      </Link>
    </aside>
  );
}

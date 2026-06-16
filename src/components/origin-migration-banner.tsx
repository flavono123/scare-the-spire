"use client";

import { ExternalLink } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

const enabledValues = new Set(["1", "true"]);

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function OriginMigrationBanner() {
  const serviceLocale = useServiceLocale();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [currentOrigin, setCurrentOrigin] = useState<string | null>(null);
  const copy = serviceMessages[serviceLocale].migration.cloudflareNotice;
  const noticeEnabled = enabledValues.has(
    process.env.NEXT_PUBLIC_SHOW_CLOUDFLARE_MIGRATION_NOTICE?.toLowerCase() ?? "",
  );
  const targetOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_ORIGIN);

  useEffect(() => {
    setCurrentOrigin(window.location.origin);
  }, []);

  const targetHref = useMemo(() => {
    if (!targetOrigin) return null;
    const query = searchParams.toString();
    return `${targetOrigin}${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams, targetOrigin]);

  if (!noticeEnabled || !targetHref || currentOrigin === null || currentOrigin === targetOrigin) {
    return null;
  }

  return (
    <div className="border-b border-cyan-400/25 bg-cyan-950/45 text-cyan-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-6">
          <span className="font-semibold text-cyan-100">{copy.label}</span>
          <span className="mx-2 text-cyan-300/70">/</span>
          <span className="text-cyan-100/85">{copy.description}</span>
        </p>
        <a
          href={targetHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-cyan-100 underline underline-offset-4 hover:text-white"
          aria-label={copy.ariaLabel}
        >
          {copy.action}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}

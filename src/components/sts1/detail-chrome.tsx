"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";

export function Sts1MetaPill({ value, color }: { value: string; color?: string }) {
  return (
    <span
      className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  );
}

export function Sts1EnglishName({
  name,
  nameEn,
  serviceLocale,
}: {
  name: string;
  nameEn: string;
  serviceLocale: ServiceLocale;
}) {
  if (!nameEn || nameEn === name) return null;
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {serviceLocale === "ko" ? "영어명" : "English name"}
      </div>
      <div className="font-game-text text-sm text-foreground">{nameEn}</div>
    </div>
  );
}

export function Sts1DetailShell({
  backHref,
  backLabel,
  onClose,
  serviceLocale,
  hero,
  heroLayout = "card",
  children,
}: {
  backHref: string;
  backLabel: string;
  onClose?: () => void;
  serviceLocale: ServiceLocale;
  hero: ReactNode;
  heroLayout?: "card" | "icon";
  children: ReactNode;
}) {
  const closeLabel = getCodexServiceMessages(serviceLocale).common.close;
  const compact = heroLayout === "icon";
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref(backHref, serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => {
            if (!onClose) return;
            event.preventDefault();
            onClose();
          }}
        >
          ← {backLabel}
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={closeLabel}
          >
            ✕
          </button>
        ) : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className={`flex flex-col items-center justify-center gap-5 ${compact ? "py-8" : "min-h-[22rem] py-4"}`}>
          {hero}
        </section>
        <aside className="flex flex-col gap-3">{children}</aside>
      </div>
    </div>
  );
}

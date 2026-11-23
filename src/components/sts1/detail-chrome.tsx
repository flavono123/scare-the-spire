"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { ServiceLocale } from "@/lib/i18n";
import { closeOnPlainClick } from "@/lib/plain-click";
import { plainSts1Text } from "@/lib/sts1/description";
import { collectSts1CardSideTips } from "@/lib/sts1/keyword-tips";
import type { Sts1EntityRefs, Sts1Keyword } from "@/lib/sts1/types";
import { Sts1EventText } from "./event-text";
import { Sts1TipBox } from "./tip-box";
import { Sts1TipsBeside } from "./mention-hover";

/** STS2's MetaPill: a label, or a token (heart + HP) as children. */
export function Sts1MetaPill({ value, color, children }: { value?: string; color?: string; children?: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-game-text text-sm font-bold"
      style={color ? { color } : undefined}
    >
      {children ?? value}
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
  assetActions,
  stageExtra,
  children,
}: {
  backHref: string;
  backLabel: string;
  onClose?: () => void;
  serviceLocale: ServiceLocale;
  hero: ReactNode;
  heroLayout?: "card" | "icon";
  assetActions?: ReactNode;
  stageExtra?: ReactNode;
  children: ReactNode;
}) {
  const localizeLink = useLocalizedHref();
  const closeLabel = getCodexServiceMessages(serviceLocale).common.close;
  const compact = heroLayout === "icon";
  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden p-4 sm:p-6">
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <Link
          prefetch={onClose ? false : undefined}
          href={localizeLink(backHref)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => closeOnPlainClick(event, onClose)}
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
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section
          {...(compact ? {} : { "data-card-detail-stage": "" })}
          className={`flex w-full min-w-0 flex-col items-center justify-center gap-4 ${compact ? "py-8" : "min-h-[34rem] py-4"}`}
        >
          {hero}
          {assetActions}
          {stageExtra}
        </section>
        <aside className="flex min-w-0 flex-col gap-3">{children}</aside>
      </div>
    </div>
  );
}

/**
 * A detail hero's text as the game tips it: TipHelper's box with the keyword tips its
 * text raises already open beside it (a detail shows every tip, as the card detail does).
 */
export function Sts1HeroTip({
  title,
  titleColor,
  icon,
  description,
  keywords,
  refs,
  className = "w-full max-w-[22rem]",
}: {
  title: ReactNode;
  titleColor?: string;
  icon?: ReactNode;
  description: string;
  keywords: readonly Sts1Keyword[];
  refs?: Sts1EntityRefs;
  className?: string;
}) {
  const tips = collectSts1CardSideTips(plainSts1Text(description), keywords);
  return (
    <Sts1TipsBeside tips={tips}>
      <Sts1TipBox title={title} titleColor={titleColor} icon={icon} className={className}>
        <Sts1EventText text={description} refs={refs} />
      </Sts1TipBox>
    </Sts1TipsBeside>
  );
}

/** The collapsible rail box STS2 details use for moves, effects and history. */
export function Sts1InfoRailSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group min-w-0 rounded-lg border border-border bg-compendium-rail px-4 py-3" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
        <span>{title}</span>
        <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

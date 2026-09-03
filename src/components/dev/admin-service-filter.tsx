"use client";

import Link from "next/link";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { SpireGhostRevealIcon } from "@/components/spire-icon";
import { DEFRAGMENT_TOKEN_SRC } from "@/lib/defragment";
import { cn } from "@/lib/utils";

export type AdminServiceFilterChip = {
  key: string;
  label: string;
  tokenSrc: string;
  href: string;
  selected: boolean;
};

export function AdminServiceFilter({
  allLabel,
  allHref,
  allSelected,
  chips,
}: {
  allLabel: string;
  allHref: string;
  allSelected: boolean;
  chips: AdminServiceFilterChip[];
}) {
  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-1"
      role="group"
      aria-label={allLabel}
    >
      <FilterChip
        selected={allSelected}
        label={allLabel}
        tokenSrc={DEFRAGMENT_TOKEN_SRC}
        href={allHref}
      />
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          selected={chip.selected}
          label={chip.label}
          tokenSrc={chip.tokenSrc}
          href={chip.href}
        />
      ))}
    </div>
  );
}

function FilterChip({
  selected,
  label,
  tokenSrc,
  href,
}: {
  selected: boolean;
  label: string;
  tokenSrc: string;
  href: string;
}) {
  return (
    <GameUiHoverTip label={label} className="inline-flex">
      <Link
        href={href}
        prefetch={false}
        aria-pressed={selected}
        aria-label={label}
        className={cn(
          "group inline-flex h-8 max-w-[9.5rem] items-center gap-1 rounded-md border px-2 text-[11px] transition-colors",
          selected
            ? "border-border/80 bg-white/10 text-foreground"
            : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
      >
        <SpireGhostRevealIcon src={tokenSrc} size={14} className="shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    </GameUiHoverTip>
  );
}

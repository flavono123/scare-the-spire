"use client";

import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { SpireGhostRevealIcon } from "@/components/spire-icon";
import {
  DEFRAGMENT_FEDERATED_SERVICES,
  DEFRAGMENT_FEED_SERVICE_META,
  DEFRAGMENT_TOKEN_SRC,
  type DefragmentFederatedService,
} from "@/lib/defragment";
import { cn } from "@/lib/utils";

export function DefragmentTypeFilter({
  value,
  onChange,
  labels,
  allLabel,
}: {
  value: DefragmentFederatedService | null;
  onChange: (service: DefragmentFederatedService | null) => void;
  labels: Record<DefragmentFederatedService, string>;
  allLabel: string;
}) {
  return (
    <div
      data-defragment-type-filter
      className="flex max-w-full flex-wrap items-center gap-1"
      role="group"
      aria-label={allLabel}
    >
      <TypeFilterChip
        selected={value === null}
        label={allLabel}
        tokenSrc={DEFRAGMENT_TOKEN_SRC}
        typeKey="all"
        onClick={() => onChange(null)}
      />
      {DEFRAGMENT_FEDERATED_SERVICES.map((service) => (
        <TypeFilterChip
          key={service}
          selected={value === service}
          label={labels[service]}
          tokenSrc={DEFRAGMENT_FEED_SERVICE_META[service].tokenSrc}
          typeKey={service}
          onClick={() => onChange(value === service ? null : service)}
        />
      ))}
    </div>
  );
}

function TypeFilterChip({
  selected,
  label,
  tokenSrc,
  typeKey,
  onClick,
}: {
  selected: boolean;
  label: string;
  tokenSrc: string;
  typeKey: string;
  onClick: () => void;
}) {
  return (
    <GameUiHoverTip label={label} className="inline-flex">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={label}
        data-defragment-type={typeKey}
        onClick={onClick}
        className={cn(
          "group inline-flex h-8 max-w-[9.5rem] items-center gap-1 rounded-md border px-2 text-[11px] transition-colors",
          selected
            ? "border-border/80 bg-white/10 text-foreground"
            : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
      >
        <SpireGhostRevealIcon src={tokenSrc} size={14} className="shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </button>
    </GameUiHoverTip>
  );
}

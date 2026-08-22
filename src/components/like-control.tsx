"use client";

import type { MouseEvent } from "react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";
import { SPIRE_ACTION_CONTROL_CLASS, SpireLikeIcon } from "@/components/spire-icon";
import { cn } from "@/lib/utils";

export function LikeControl({
  count,
  liked,
  pending = false,
  blocked = false,
  disabled = false,
  onToggle,
  tipLabel,
  tipLabelActive,
  lift = false,
  size = 16,
  alwaysShowCount = false,
  className,
}: {
  count: number;
  liked: boolean;
  pending?: boolean;
  blocked?: boolean;
  disabled?: boolean;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  tipLabel?: string;
  tipLabelActive?: string;
  lift?: boolean;
  size?: number;
  alwaysShowCount?: boolean;
  className?: string;
}) {
  const tip = liked && tipLabelActive ? tipLabelActive : tipLabel;
  const inert = pending || blocked || disabled;
  const icon = blocked ? (
    <EngagementUnavailableIcon size={size} />
  ) : pending ? (
    <EngagementSpinner size={size} />
  ) : (
    <SpireLikeIcon size={size} active={liked} lift={lift} />
  );

  const button = (
    <button
      type="button"
      onClick={onToggle}
      disabled={inert}
      className={cn(
        SPIRE_ACTION_CONTROL_CLASS,
        "gap-1 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40",
        liked && "text-[#d4a843]",
        className,
      )}
      aria-label={tip}
      aria-pressed={liked}
    >
      {icon}
      {(alwaysShowCount || (!blocked && !pending)) && (
        <span className="tabular-nums">{count}</span>
      )}
    </button>
  );

  if (!tipLabel || blocked || pending) return button;

  return <GameUiHoverTip label={tip ?? tipLabel}>{button}</GameUiHoverTip>;
}

"use client";

import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { SPIRE_ACTION_CONTROL_CLASS, SpireLikeIcon } from "@/components/spire-icon";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";
import { cn } from "@/lib/utils";

export function ThisOrThatLikeButton({
  count,
  liked,
  loading,
  unavailable,
  disabled,
  onToggle,
  label,
  tipLabel,
  tipLabelActive,
  lift = false,
  className,
}: {
  count: number;
  liked: boolean;
  loading: boolean;
  unavailable: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
  tipLabel?: string;
  tipLabelActive?: string;
  lift?: boolean;
  className?: string;
}) {
  const blocked = unavailable || disabled;
  const tip = liked && tipLabelActive ? tipLabelActive : tipLabel ?? label;

  const button = (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      disabled={blocked || loading}
      className={cn(
        SPIRE_ACTION_CONTROL_CLASS,
        "gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        liked && "text-[#d4a843]",
        className,
      )}
      title={label}
      aria-label={tip}
      aria-pressed={liked}
    >
      {unavailable ? (
        <EngagementUnavailableIcon size={16} />
      ) : loading ? (
        <EngagementSpinner size={16} />
      ) : (
        <SpireLikeIcon size={16} active={liked} lift={lift} />
      )}
      <span className="tabular-nums">{count}</span>
    </button>
  );

  if (!tipLabel || unavailable || loading) return button;

  return <GameUiHoverTip label={tip}>{button}</GameUiHoverTip>;
}

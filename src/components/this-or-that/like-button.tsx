"use client";

import { LikeControl } from "@/components/like-control";

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
  return (
    <LikeControl
      count={count}
      liked={liked}
      pending={loading}
      blocked={unavailable}
      disabled={disabled}
      onToggle={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      tipLabel={tipLabel ?? label}
      tipLabelActive={tipLabelActive}
      lift={lift}
      size={16}
      alwaysShowCount
      className={className}
    />
  );
}

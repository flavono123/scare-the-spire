"use client";

import { MessageCircle } from "lucide-react";
import { SpireLikeIcon } from "@/components/spire-icon";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";

interface EngagementSummaryProps {
  commentCount: number;
  likeCount?: number;
  loading?: boolean;
  unavailable?: boolean;
  showZeroComments?: boolean;
  showLikes?: boolean;
  className?: string;
}

export function EngagementSummary({
  commentCount,
  likeCount = 0,
  loading = false,
  unavailable = false,
  showZeroComments = false,
  showLikes = false,
  className = "",
}: EngagementSummaryProps) {
  if (unavailable) {
    return (
      <span className={`inline-flex align-middle ${className}`}>
        <EngagementUnavailableIcon size={12} />
      </span>
    );
  }

  if (loading) {
    return (
      <span className={`inline-flex align-middle ${className}`}>
        <EngagementSpinner size={12} />
      </span>
    );
  }

  const shouldShowComments = showZeroComments || commentCount > 0;
  const shouldShowLikes = showLikes || likeCount > 0;
  if (!shouldShowComments && !shouldShowLikes) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      {shouldShowComments && (
        <span className="inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground/50">
          <MessageCircle size={12} aria-hidden />
          <span className="tabular-nums">({commentCount})</span>
        </span>
      )}
      {shouldShowLikes && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
          <SpireLikeIcon size={14} />
          <span className="tabular-nums">{likeCount}</span>
        </span>
      )}
    </span>
  );
}

"use client";

import Image from "@/components/ui/static-image";
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
        <span className="text-xs font-normal text-muted-foreground/50">
          ({commentCount})
        </span>
      )}
      {shouldShowLikes && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
          <Image
            src="/images/relics/runic-dodecahedron.webp"
            alt="like"
            width={14}
            height={14}
            className="opacity-40 grayscale"
          />
          <span>{likeCount}</span>
        </span>
      )}
    </span>
  );
}

"use client";

import { useState } from "react";
import { CommentSection } from "@/components/comment-section";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  buildSts1CommentThreadKey,
  type Sts1CommentResourceType,
} from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";

export function Sts1CommentsRail({
  resourceType,
  slug,
  serviceLocale,
}: {
  resourceType: Sts1CommentResourceType;
  slug: string;
  serviceLocale: ServiceLocale;
}) {
  const [commentCount, setCommentCount] = useState(0);
  const commentsLabel = getCodexServiceMessages(serviceLocale).common.comments;
  return (
    <details
      id="comments"
      className="group rounded-lg border border-border bg-compendium-rail px-4 py-3"
      open
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
        <span>{`${commentsLabel}${commentCount > 0 ? ` (${commentCount})` : ""}`}</span>
        <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">
        <CommentSection
          threadKey={buildSts1CommentThreadKey(resourceType, slug)}
          onCountChange={setCommentCount}
        />
      </div>
    </details>
  );
}

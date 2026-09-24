"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import {
  INDEX_LUCIDE_ICON_CLASS,
  SPIRE_ACTION_CONTROL_CLASS,
} from "@/components/spire-icon";

export function NeowsletterClaimThread({
  threadKey,
  label,
}: {
  threadKey: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="mt-1"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary
        className={`${SPIRE_ACTION_CONTROL_CLASS} cursor-pointer list-none gap-1 text-xs text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden`}
      >
        <MessageCircle size={15} className={INDEX_LUCIDE_ICON_CLASS} aria-hidden />
        <span>{label}</span>
      </summary>
      <div className="mt-1">
        {open ? (
          <CommentSection threadKey={threadKey} density="inline" />
        ) : (
          <div
            data-patch-comment-root
            data-thread-key={threadKey}
            data-comment-density="inline"
          />
        )}
      </div>
    </details>
  );
}

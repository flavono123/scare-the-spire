"use client";

import { useState } from "react";
import { DeferredCommentSection } from "@/components/patches/deferred-comment-section";

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
      <summary className="inline cursor-pointer list-none text-xs text-muted-foreground marker:content-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      {open ? (
        <div className="mt-2 max-w-xl">
          <DeferredCommentSection threadKey={threadKey} />
        </div>
      ) : (
        <div className="mt-2" data-patch-comment-root data-thread-key={threadKey} />
      )}
    </details>
  );
}

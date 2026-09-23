"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import { CommentSection } from "@/components/comment-section";

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
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[11px] leading-none text-primary marker:content-none hover:bg-primary/20 [&::-webkit-details-marker]:hidden">
        <Image
          src="/images/sts2/ui/emote/exclaim.png"
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5 object-contain"
        />
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

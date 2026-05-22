"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const CommentSection = dynamic(
  () => import("@/components/comment-section").then((mod) => mod.CommentSection),
  {
    ssr: false,
    loading: () => (
      <div className="h-4 w-24 animate-pulse rounded bg-muted/30" />
    ),
  },
);

export function DeferredCommentSection({
  threadKey,
  loadLabel,
}: {
  threadKey: string;
  loadLabel: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-yellow-500/40 hover:text-foreground"
      >
        {loadLabel}
      </button>
    );
  }

  return <CommentSection threadKey={threadKey} />;
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
}: {
  threadKey: string;
}) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = mountRef.current;
    if (!target || shouldLoad) return;

    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = setTimeout(() => setShouldLoad(true), 0);
      return () => clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoad]);

  if (!shouldLoad) {
    return (
      <div
        ref={mountRef}
        data-patch-comment-root
        data-thread-key={threadKey}
        className="space-y-3"
      >
        <div
          className="h-4 w-24 rounded bg-muted/20"
          aria-hidden="true"
        />
      </div>
    );
  }

  return <CommentSection threadKey={threadKey} />;
}

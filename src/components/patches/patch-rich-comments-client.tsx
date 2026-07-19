"use client";

import React from "react";
import { createRoot } from "react-dom/client";
import { CommentSection } from "@/components/comment-section";

function mountRichPatchComments() {
  const roots = document.querySelectorAll<HTMLElement>("[data-patch-comment-root]");

  for (const root of roots) {
    const threadKey = root.dataset.threadKey;
    if (!threadKey || "richCommentMounted" in root.dataset) continue;

    root.dataset.richCommentMounted = "";
    const render = () => {
      createRoot(root).render(React.createElement(CommentSection, { threadKey }));
    };

    if (typeof IntersectionObserver === "undefined") {
      window.setTimeout(render, 0);
      continue;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        render();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(root);
  }
}

mountRichPatchComments();

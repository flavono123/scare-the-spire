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
    createRoot(root).render(React.createElement(CommentSection, { threadKey }));
  }
}

mountRichPatchComments();

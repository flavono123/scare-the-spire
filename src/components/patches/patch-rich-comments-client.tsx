"use client";

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommentSection } from "@/components/comment-section";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import type { ServiceLocale } from "@/lib/i18n";
import type { ResolvedPatchArt } from "@/lib/sts2-patch-art";
import type { STS2Patch, STS2PatchLine } from "@/lib/types";

const PATCH_STORY_CONFIG_ID = "sts-patch-story-config";

interface PatchStoryConfig {
  serviceLocale: ServiceLocale;
  storyPlaceholder: string;
  patchLines: STS2PatchLine[];
  patches: STS2Patch[];
  patchArt: ResolvedPatchArt;
}

function readPatchStoryConfig(): PatchStoryConfig | null {
  const element = document.getElementById(PATCH_STORY_CONFIG_ID);
  if (!element?.textContent) return null;

  try {
    const parsed = JSON.parse(element.textContent) as Partial<PatchStoryConfig>;
    if (
      (parsed.serviceLocale !== "ko" && parsed.serviceLocale !== "en")
      || typeof parsed.storyPlaceholder !== "string"
      || !Array.isArray(parsed.patchLines)
      || !Array.isArray(parsed.patches)
      || !parsed.patchArt
    ) return null;
    return parsed as PatchStoryConfig;
  } catch {
    return null;
  }
}

function PatchStoryComposer({
  config,
  initialPatchLineId,
  onClose,
}: {
  config: PatchStoryConfig;
  initialPatchLineId: string;
  onClose: () => void;
}) {
  const { userId, ready, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId);

  return (
    <StoryComposerModal
      serviceLocale={config.serviceLocale}
      storyPlaceholder={config.storyPlaceholder}
      userId={userId}
      authReady={ready}
      ensureUser={ensureUser}
      patchLines={config.patchLines}
      patches={config.patches}
      patchArt={config.patchArt}
      initialPatchLineId={initialPatchLineId}
      onAdd={communityStories.add}
      onClose={onClose}
    />
  );
}

function mountRichPatchStoryComposer() {
  const config = readPatchStoryConfig();
  if (!config) return;

  let activeRoot: Root | null = null;
  let activeHost: HTMLElement | null = null;

  const close = () => {
    activeRoot?.unmount();
    activeHost?.remove();
    activeRoot = null;
    activeHost = null;
  };

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const action = event.target.closest<HTMLElement>("[data-patch-line-story-action]");
    const patchLineId = action?.dataset.patchLineId;
    if (!action || !patchLineId) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    close();
    document.querySelector("[data-static-story-composer]")?.remove();

    const host = document.createElement("div");
    host.dataset.patchStoryComposerRoot = "";
    document.body.appendChild(host);
    const root = createRoot(host);
    activeHost = host;
    activeRoot = root;
    root.render(
      <PatchStoryComposer
        config={config}
        initialPatchLineId={patchLineId}
        onClose={close}
      />,
    );
  });
}

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
mountRichPatchStoryComposer();

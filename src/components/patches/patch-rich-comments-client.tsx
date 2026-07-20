"use client";

import React, { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommentSection } from "@/components/comment-section";
import { patchLineStoryCopy } from "@/components/patches/patch-note-with-story-actions";
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
  patchId: string;
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
      || typeof parsed.patchId !== "string"
      || !Array.isArray(parsed.patchLines)
      || !Array.isArray(parsed.patches)
      || !parsed.patchArt
    ) return null;
    return parsed as PatchStoryConfig;
  } catch {
    return null;
  }
}

function PatchStoryCountSync({ config }: { config: PatchStoryConfig }) {
  const communityStories = useCommunityStories(null, { source: config.patchId, limit: 200 });

  useEffect(() => {
    const counts = new Map<string, number>();
    for (const story of communityStories.stories) {
      if (!story.community || !story.patchLineId) continue;
      counts.set(story.patchLineId, (counts.get(story.patchLineId) ?? 0) + 1);
    }

    const copy = patchLineStoryCopy(config.serviceLocale);
    document.querySelectorAll<HTMLElement>("[data-patch-line-story-action]").forEach((action) => {
      const patchLineId = action.dataset.patchLineId;
      if (!patchLineId) return;

      const staticCount = Number.parseInt(action.dataset.staticStoryCount ?? "0", 10);
      const total = (Number.isFinite(staticCount) ? staticCount : 0) + (counts.get(patchLineId) ?? 0);
      const count = action.querySelector<HTMLElement>("[data-patch-line-story-count]");
      if (count) count.textContent = String(total);

      const actionLabel = total > 0 || communityStories.unavailable ? copy.open : copy.openEmpty;
      action.dataset.storyCountPositive = String(total > 0);
      action.title = actionLabel;
      action.setAttribute("aria-label", `${actionLabel}. ${copy.countLabel(total)}`);
    });
  }, [communityStories.stories, communityStories.unavailable, config.serviceLocale]);

  return null;
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

  const countHost = document.createElement("div");
  countHost.dataset.patchStoryCountRoot = "";
  document.body.appendChild(countHost);
  createRoot(countHost).render(<PatchStoryCountSync config={config} />);

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

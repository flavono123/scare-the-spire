"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CommentSection } from "@/components/comment-section";
import {
  PatchLineStoriesPanel,
  patchLineStoryCopy,
  sortPatchLineStories,
} from "@/components/patches/patch-note-with-story-actions";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import type { ServiceLocale } from "@/lib/i18n";
import type { ResolvedPatchArt } from "@/lib/sts2-patch-art";
import type { STS2Patch, STS2PatchLine, Story } from "@/lib/types";

const PATCH_STORY_CONFIG_ID = "sts-patch-story-config";

interface PatchStoryConfig {
  serviceLocale: ServiceLocale;
  storyPlaceholder: string;
  patchId: string;
  patchLines: STS2PatchLine[];
  staticStories: Story[];
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
      || !Array.isArray(parsed.staticStories)
      || !Array.isArray(parsed.patches)
      || !parsed.patchArt
    ) return null;
    return parsed as PatchStoryConfig;
  } catch {
    return null;
  }
}

function PatchStorySurface({ config }: { config: PatchStoryConfig }) {
  const { userId, ready, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId, { source: config.patchId, limit: 200 });
  const [activePatchLineId, setActivePatchLineId] = useState<string | null>(null);
  const [composerPatchLineId, setComposerPatchLineId] = useState<string | null>(null);
  const activePatchLine = useMemo(
    () => config.patchLines.find((patchLine) => patchLine.id === activePatchLineId) ?? null,
    [activePatchLineId, config.patchLines],
  );
  const composerPatchLine = useMemo(
    () => config.patchLines.find((patchLine) => patchLine.id === composerPatchLineId) ?? null,
    [composerPatchLineId, config.patchLines],
  );
  const activePatchLineStories = useMemo(() => {
    if (!activePatchLine) return [];
    const communityPatchLineStories = communityStories.stories.filter((story) =>
      story.community && story.patchLineId === activePatchLine.id,
    );
    const staticPatchLineStories = config.staticStories.filter((story) =>
      story.patchLineId === activePatchLine.id,
    );
    return sortPatchLineStories([...communityPatchLineStories, ...staticPatchLineStories]);
  }, [activePatchLine, communityStories.stories, config.staticStories]);

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

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const action = event.target.closest<HTMLElement>("[data-patch-line-story-action]");
      const patchLineId = action?.dataset.patchLineId;
      if (!action || !patchLineId) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector("[data-static-story-composer]")?.remove();

      const count = Number.parseInt(
        action.querySelector<HTMLElement>("[data-patch-line-story-count]")?.textContent ?? "0",
        10,
      );
      if (count > 0 || communityStories.loading || communityStories.unavailable) {
        setComposerPatchLineId(null);
        setActivePatchLineId(patchLineId);
      } else {
        setActivePatchLineId(null);
        setComposerPatchLineId(patchLineId);
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [communityStories.loading, communityStories.unavailable]);

  return (
    <>
      {activePatchLine && (
        <PatchLineStoriesPanel
          patchLine={activePatchLine}
          stories={activePatchLineStories}
          serviceLocale={config.serviceLocale}
          patches={config.patches}
          communityLoading={communityStories.loading}
          communityUnavailable={communityStories.unavailable}
          onClose={() => setActivePatchLineId(null)}
          onWrite={() => {
            setComposerPatchLineId(activePatchLine.id);
            setActivePatchLineId(null);
          }}
        />
      )}
      {composerPatchLine && (
        <StoryComposerModal
          serviceLocale={config.serviceLocale}
          storyPlaceholder={config.storyPlaceholder}
          userId={userId}
          authReady={ready}
          ensureUser={ensureUser}
          patchLines={config.patchLines}
          patches={config.patches}
          patchArt={config.patchArt}
          initialPatchLineId={composerPatchLine.id}
          onAdd={communityStories.add}
          onClose={() => setComposerPatchLineId(null)}
        />
      )}
    </>
  );
}

function mountRichPatchStorySurface() {
  const config = readPatchStoryConfig();
  if (!config) return;

  const host = document.createElement("div");
  host.dataset.patchStorySurfaceRoot = "";
  document.body.appendChild(host);
  createRoot(host).render(<PatchStorySurface config={config} />);
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
mountRichPatchStorySurface();

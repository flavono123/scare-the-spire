"use client";

import Image from "@/components/ui/static-image";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PatchLineStoriesPanel, sortPatchLineStories } from "@/components/patches/patch-note-with-story-actions";
import { ResourcePatchChangeList } from "@/components/patches/resource-patch-history";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { StoryStatIcon } from "@/components/story-token-icon";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import type { ServiceLocale } from "@/lib/i18n";
import {
  findResourcePatchIndexResource,
  resourcePatchLines,
  type ResourcePatchIndexData,
  type ResourcePatchIndexResource,
} from "@/lib/resource-patch-index";
import type { STS2PatchLine, Story, StoryEntityType } from "@/lib/types";

const PRIMARY_RESOURCE_COUNT = 5;

const COPY = {
  ko: {
    search: "카드, 유물, 몬스터 이름 검색",
    noResults: "일치하는 변경 기록이 없습니다",
    changes: (count: number) => `변경항목 ${count}개`,
    more: "더 보기",
    less: "접기",
    story: (count: number) => count > 0 ? `이 변경의 이야기 ${count}개` : "이 변경으로 이야기 쓰기",
  },
  en: {
    search: "Search cards, relics, or monsters",
    noResults: "No matching change history",
    changes: (count: number) => `${count} changes`,
    more: "Show more",
    less: "Show less",
    story: (count: number) => count > 0 ? `${count} stories for this change` : "Write a story from this change",
  },
} as const;

function normalizeQuery(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "").trim();
}

function resourceMatches(resource: ResourcePatchIndexResource, query: string): boolean {
  if (!query) return true;
  return normalizeQuery(`${resource.nameKo} ${resource.nameEn} ${resource.id}`).includes(query);
}

function resourceKey(resource: Pick<ResourcePatchIndexResource, "type" | "id">): string {
  return `${resource.type}:${resource.id}`;
}

function findInitialResource(data: ResourcePatchIndexData): ResourcePatchIndexResource {
  const character = data.groups.find((group) => group.type === "character")?.resources[0];
  const first = character ?? data.groups[0]?.resources[0];
  if (!first) throw new Error("Resource patch index has no resources");
  return first;
}

function countStoriesByPatchLine(stories: { patchLineId?: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const story of stories) {
    if (!story.patchLineId) continue;
    counts.set(story.patchLineId, (counts.get(story.patchLineId) ?? 0) + 1);
  }
  return counts;
}

function ResourceToken({
  resource,
  selected,
  serviceLocale,
  onSelect,
}: {
  resource: ResourcePatchIndexResource;
  selected: boolean;
  serviceLocale: ServiceLocale;
  onSelect: () => void;
}) {
  const label = serviceLocale === "ko" ? resource.nameKo : resource.nameEn;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${label} · ${resource.changeCount}`}
      className={`group/resource inline-flex h-9 min-w-0 items-center gap-1.5 rounded px-1.5 text-left transition-all ${
        selected
          ? "bg-yellow-500/[0.09] text-yellow-200 shadow-[0_0_14px_rgba(234,179,8,0.08)]"
          : "text-gray-400 hover:bg-white/[0.035] hover:text-gray-200"
      }`}
    >
      {resource.imageUrl ? (
        <Image
          src={resource.imageUrl}
          alt=""
          width={28}
          height={28}
          className={`h-7 w-7 shrink-0 object-contain transition-transform group-hover/resource:scale-110 ${
            selected ? "drop-shadow-[0_0_5px_rgba(234,179,8,0.35)]" : ""
          }`}
        />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-600" />
      )}
      <span className="max-w-28 truncate font-game-text text-xs">{label}</span>
      <span className="text-[10px] tabular-nums text-gray-600">{resource.changeCount}</span>
    </button>
  );
}

function StoryAction({
  count,
  line,
  unavailable,
  serviceLocale,
  onOpen,
  onWrite,
}: {
  count: number;
  line: STS2PatchLine;
  unavailable: boolean;
  serviceLocale: ServiceLocale;
  onOpen: () => void;
  onWrite: () => void;
}) {
  const label = COPY[serviceLocale].story(count);
  return (
    <button
      type="button"
      onClick={() => count > 0 || unavailable ? onOpen() : onWrite()}
      className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-[#fb923c]/65 transition-colors hover:text-[#fed7aa] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#fb923c]/50"
      title={label}
      aria-label={`${label}: ${line.id}`}
    >
      <StoryStatIcon size={15} className="opacity-75" />
      <span>{count}</span>
    </button>
  );
}

export function ResourcePatchIndexExplorer({
  data,
  serviceLocale,
  storyPlaceholder,
}: {
  data: ResourcePatchIndexData;
  serviceLocale: ServiceLocale;
  storyPlaceholder: string;
}) {
  const copy = COPY[serviceLocale];
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(() => resourceKey(findInitialResource(data)));
  const [expandedGroups, setExpandedGroups] = useState<Set<StoryEntityType>>(() => new Set());
  const [activePatchLineId, setActivePatchLineId] = useState<string | null>(null);
  const [composerPatchLineId, setComposerPatchLineId] = useState<string | null>(null);
  const { userId, ready: authReady, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId, { limit: 1_000 });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type") as StoryEntityType | null;
      const id = params.get("id");
      if (!type || !id) return;
      const resource = findResourcePatchIndexResource(data, type, id);
      if (resource) setSelectedKey(resourceKey(resource));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [data]);

  const selectedResource = useMemo(() => {
    for (const group of data.groups) {
      const match = group.resources.find((resource) => resourceKey(resource) === selectedKey);
      if (match) return match;
    }
    return findInitialResource(data);
  }, [data, selectedKey]);
  const selectedLines = useMemo(
    () => resourcePatchLines(data, selectedResource),
    [data, selectedResource],
  );
  const normalizedQuery = normalizeQuery(query);
  const staticStoryCounts = useMemo(
    () => countStoriesByPatchLine(data.staticStories),
    [data.staticStories],
  );
  const communityStoryCounts = useMemo(
    () => countStoriesByPatchLine(communityStories.stories),
    [communityStories.stories],
  );
  const activePatchLine = activePatchLineId ? data.lines[activePatchLineId] ?? null : null;
  const composerPatchLine = composerPatchLineId ? data.lines[composerPatchLineId] ?? null : null;
  const activeStories = useMemo(() => {
    if (!activePatchLine) return [];
    const matches = [...data.staticStories, ...communityStories.stories]
      .filter((story): story is Story => story.patchLineId === activePatchLine.id);
    return sortPatchLineStories(matches);
  }, [activePatchLine, communityStories.stories, data.staticStories]);

  const selectResource = (resource: ResourcePatchIndexResource) => {
    setSelectedKey(resourceKey(resource));
    const url = new URL(window.location.href);
    url.searchParams.set("type", resource.type);
    url.searchParams.set("id", resource.id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const storyAction = (line: STS2PatchLine): ReactNode => {
    const count = (staticStoryCounts.get(line.id) ?? 0) + (communityStoryCounts.get(line.id) ?? 0);
    return (
      <StoryAction
        count={count}
        line={line}
        unavailable={communityStories.unavailable}
        serviceLocale={serviceLocale}
        onOpen={() => setActivePatchLineId(line.id)}
        onWrite={() => setComposerPatchLineId(line.id)}
      />
    );
  };
  const selectedLabel = serviceLocale === "ko" ? selectedResource.nameKo : selectedResource.nameEn;

  return (
    <>
      <label className="relative mt-5 block max-w-xl">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          className="h-10 w-full rounded-md border border-white/10 bg-white/[0.035] pl-9 pr-3 font-game-text text-sm text-foreground outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500/35"
        />
      </label>

      <div className="mt-5 space-y-1 border-y border-white/[0.08] py-2">
        {data.groups.map((group) => {
          const filtered = group.resources.filter((resource) => resourceMatches(resource, normalizedQuery));
          if (normalizedQuery && filtered.length === 0) return null;
          const expanded = expandedGroups.has(group.type);
          const visible = normalizedQuery || expanded || group.type === "character"
            ? filtered
            : filtered.slice(0, PRIMARY_RESOURCE_COUNT);
          const canExpand = !normalizedQuery && group.type !== "character" && filtered.length > PRIMARY_RESOURCE_COUNT;
          return (
            <section key={group.type} className="grid min-w-0 gap-1 py-1.5 md:grid-cols-[7rem_minmax(0,1fr)] md:items-start">
              <h2 className="px-1.5 pt-2 font-game-title text-xs text-gray-500">
                {serviceLocale === "ko" ? group.labelKo : group.labelEn}
              </h2>
              <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
                {visible.map((resource) => (
                  <ResourceToken
                    key={resourceKey(resource)}
                    resource={resource}
                    selected={resourceKey(resource) === resourceKey(selectedResource)}
                    serviceLocale={serviceLocale}
                    onSelect={() => selectResource(resource)}
                  />
                ))}
                {canExpand && (
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group.type)) next.delete(group.type);
                      else next.add(group.type);
                      return next;
                    })}
                    className="h-8 px-2 font-game-title text-xs spire-blue transition-colors hover:text-blue-300"
                  >
                    {expanded ? copy.less : `… ${copy.more}`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
        {normalizedQuery && data.groups.every((group) =>
          group.resources.every((resource) => !resourceMatches(resource, normalizedQuery)),
        ) && (
          <p className="px-2 py-6 text-center font-game-text text-sm text-gray-500">{copy.noResults}</p>
        )}
      </div>

      <section className="mt-7" aria-live="polite">
        <div className="mb-3 flex min-w-0 items-center gap-3">
          {selectedResource.imageUrl && (
            <Image
              src={selectedResource.imageUrl}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(234,179,8,0.18)]"
            />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-game-title text-xl font-semibold spire-gold">{selectedLabel}</h2>
            <p className="font-game-text text-xs text-gray-500">{copy.changes(selectedResource.changeCount)}</p>
          </div>
        </div>
        {selectedLines.length > 0 ? (
          <ResourcePatchChangeList
            lines={selectedLines}
            patches={data.patches}
            serviceLocale={serviceLocale}
            trailingAction={storyAction}
          />
        ) : (
          <p className="border-y border-white/[0.08] py-8 text-center font-game-text text-sm text-gray-500">
            {copy.noResults}
          </p>
        )}
      </section>

      {activePatchLine && (
        <PatchLineStoriesPanel
          patchLine={activePatchLine}
          stories={activeStories}
          serviceLocale={serviceLocale}
          patches={data.patches}
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
          serviceLocale={serviceLocale}
          storyPlaceholder={storyPlaceholder}
          userId={userId}
          authReady={authReady}
          ensureUser={ensureUser}
          patchLines={selectedLines}
          patches={data.patches}
          initialPatchLineId={composerPatchLine.id}
          onAdd={communityStories.add}
          onClose={() => setComposerPatchLineId(null)}
        />
      )}
    </>
  );
}

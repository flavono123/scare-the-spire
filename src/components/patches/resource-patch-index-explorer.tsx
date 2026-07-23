"use client";

import Image from "@/components/ui/static-image";
import { CircleHelp, Ellipsis, EllipsisVertical, Search, Shrink } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameHoverTip } from "@/components/codex/hover-tip";
import {
  PatchLineStoriesPanel,
  PatchLineStoryAction,
  sortPatchLineStories,
} from "@/components/patches/patch-note-with-story-actions";
import { ResourcePatchChangeList } from "@/components/patches/resource-patch-history";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  findResourcePatchIndexResource,
  resourcePatchLines,
  type ResourcePatchIndexData,
  type ResourcePatchIndexGroup,
  type ResourcePatchIndexResource,
} from "@/lib/resource-patch-index";
import { sts2NavItems } from "@/lib/site-nav-items";
import type { STS2PatchLine, Story, StoryEntityType } from "@/lib/types";
import { serviceMessages } from "@/messages/service";

const DEFAULT_VISIBLE_GROUP_COUNT = 4;
const FALLBACK_RESOURCE_TOKEN_CAPACITY = 6;
const RESOURCE_TOKEN_SIZE = 32;
const RESOURCE_TOKEN_GAP = 2;

function normalizeQuery(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "").trim();
}

function resourceGroupLabel(type: StoryEntityType, serviceLocale: ServiceLocale): string {
  const copy = serviceMessages[serviceLocale].codex;
  switch (type) {
    case "character": return copy.characters;
    case "card": return copy.cards;
    case "relic": return copy.relics;
    case "potion": return copy.potions;
    case "power": return copy.powers;
    case "enchantment": return copy.enchantments;
    case "affliction": return copy.afflictions;
    case "event": return copy.events;
    case "monster": return copy.monsters;
    case "encounter": return copy.encounters;
    case "ancient": return copy.ancients;
    case "epoch": return copy.epochs;
  }
}

function navIcon(labelKey: (typeof sts2NavItems)[number]["labelKey"]): string {
  const item = sts2NavItems.find((candidate) => candidate.labelKey === labelKey);
  if (!item) throw new Error(`Missing Compendium navigation icon: ${labelKey}`);
  return item.icon;
}

const RESOURCE_GROUP_ICON: Record<StoryEntityType, string> = {
  character: navIcon("characters"),
  card: navIcon("cards"),
  relic: navIcon("relics"),
  potion: navIcon("potions"),
  power: navIcon("powers"),
  enchantment: navIcon("enchantments"),
  affliction: navIcon("enchantments"),
  event: navIcon("events"),
  monster: navIcon("monsters"),
  encounter: "/images/sts2/map/icons/map_monster.png",
  ancient: navIcon("ancients"),
  epoch: navIcon("epochs"),
};

function resourceMatches(resource: ResourcePatchIndexResource, query: string): boolean {
  if (!query) return true;
  return normalizeQuery(
    `${resource.nameKo} ${resource.nameEn} ${Object.values(resource.names ?? {}).join(" ")} ${resource.id}`,
  ).includes(query);
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

function IndexTokenTooltip({
  title,
  suppressed = false,
}: {
  title: string;
  suppressed?: boolean;
}) {
  if (suppressed) return null;

  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 hidden -translate-x-1/2 pb-1 group-hover/index-token:block group-focus-within/index-token:block">
      <GameHoverTip
        title={title}
        compact
        style={{ width: "max-content", maxWidth: "calc(100vw - 16px)" }}
      />
    </span>
  );
}

function ResourceGroupToken({
  type,
  active,
  serviceLocale,
}: {
  type: StoryEntityType;
  active: boolean;
  serviceLocale: ServiceLocale;
}) {
  const label = resourceGroupLabel(type, serviceLocale);
  const icon = RESOURCE_GROUP_ICON[type];
  return (
    <span
      className={`group/index-token relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition-colors ${
        active
          ? "bg-sky-400/10 ring-sky-300/30"
          : "bg-sky-950/25 ring-sky-200/10"
      }`}
      aria-label={label}
    >
      <Image
        src={icon}
        alt=""
        width={22}
        height={22}
        className={`h-[22px] w-[22px] object-contain ${active ? "opacity-100" : "opacity-60"}`}
      />
      <IndexTokenTooltip title={label} />
    </span>
  );
}

function ResourceToken({
  resource,
  selected,
  serviceLocale,
  gameLocale,
  onSelect,
}: {
  resource: ResourcePatchIndexResource;
  selected: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  onSelect: () => void;
}) {
  const label = resource.names?.[gameLocale]
    ?? (serviceLocale === "ko" ? resource.nameKo : resource.nameEn);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      className="group/index-token relative inline-flex h-8 w-8 shrink-0 items-center justify-center outline-none"
    >
      {resource.imageUrl ? (
        <Image
          src={resource.imageUrl}
          alt=""
          width={28}
          height={28}
          className={`h-7 w-7 object-contain transition-[transform,filter] duration-150 group-hover/index-token:scale-110 group-hover/index-token:brightness-125 group-hover/index-token:drop-shadow-[0_0_5px_rgba(234,179,8,0.35)] group-focus-visible/index-token:scale-110 group-focus-visible/index-token:brightness-125 group-focus-visible/index-token:drop-shadow-[0_0_5px_rgba(234,179,8,0.35)] ${
            selected
              ? "scale-110 brightness-125 drop-shadow-[0_0_5px_rgba(234,179,8,0.35)]"
              : ""
          }`}
        />
      ) : (
        <CircleHelp
          size={17}
          className="text-zinc-600 transition-[transform,filter,color] duration-150 group-hover/index-token:scale-110 group-hover/index-token:text-zinc-300 group-hover/index-token:drop-shadow-[0_0_5px_rgba(234,179,8,0.35)] group-focus-visible/index-token:scale-110 group-focus-visible/index-token:text-zinc-300"
        />
      )}
      <IndexTokenTooltip title={label} />
    </button>
  );
}

function ResourceGroupRow({
  group,
  resources,
  selectedResource,
  expanded,
  searching,
  serviceLocale,
  gameLocale,
  moreLabel,
  lessLabel,
  onToggle,
  onSelect,
}: {
  group: ResourcePatchIndexGroup;
  resources: ResourcePatchIndexResource[];
  selectedResource: ResourcePatchIndexResource;
  expanded: boolean;
  searching: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  moreLabel: string;
  lessLabel: string;
  onToggle: () => void;
  onSelect: (resource: ResourcePatchIndexResource) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [tokenCapacity, setTokenCapacity] = useState(FALLBACK_RESOURCE_TOKEN_CAPACITY);
  const [toggleTooltipSuppressed, setToggleTooltipSuppressed] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const updateCapacity = () => {
      const width = row.getBoundingClientRect().width;
      const nextCapacity = Math.max(
        1,
        Math.floor((width + RESOURCE_TOKEN_GAP) / (RESOURCE_TOKEN_SIZE + RESOURCE_TOKEN_GAP)),
      );
      setTokenCapacity((current) => current === nextCapacity ? current : nextCapacity);
    };

    updateCapacity();
    const observer = new ResizeObserver(updateCapacity);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const hasOverflow = !searching && resources.length > tokenCapacity;
  const visibleResources = searching || expanded || !hasOverflow
    ? resources
    : resources.slice(0, Math.max(1, tokenCapacity - 1));

  return (
    <section
      aria-label={resourceGroupLabel(group.type, serviceLocale)}
      className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-1.5 rounded-lg bg-white/[0.012] py-0.5"
    >
      <div className="flex h-8 items-center justify-center">
        <ResourceGroupToken
          type={group.type}
          active={selectedResource.type === group.type}
          serviceLocale={serviceLocale}
        />
      </div>
      <div ref={rowRef} className="flex min-w-0 flex-wrap items-center gap-0.5">
        {visibleResources.map((resource) => (
          <ResourceToken
            key={resourceKey(resource)}
            resource={resource}
            selected={resourceKey(resource) === resourceKey(selectedResource)}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            onSelect={() => onSelect(resource)}
          />
        ))}
        {hasOverflow && (
          <button
            type="button"
            onClick={(event) => {
              if (event.detail > 0) event.currentTarget.blur();
              setToggleTooltipSuppressed(true);
              onToggle();
            }}
            onPointerLeave={(event) => {
              if (document.activeElement !== event.currentTarget) {
                setToggleTooltipSuppressed(false);
              }
            }}
            onFocus={() => setToggleTooltipSuppressed(false)}
            onBlur={() => setToggleTooltipSuppressed(false)}
            aria-expanded={expanded}
            aria-label={expanded ? lessLabel : moreLabel}
            className="group/index-token relative inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-300/55 transition-colors hover:bg-sky-400/[0.07] hover:text-sky-200"
          >
            {expanded ? <Shrink size={16} /> : <Ellipsis size={17} />}
            <IndexTokenTooltip
              title={expanded ? lessLabel : moreLabel}
              suppressed={toggleTooltipSuppressed}
            />
          </button>
        )}
      </div>
    </section>
  );
}

export function ResourcePatchIndexExplorer({
  data,
  serviceLocale,
  gameLocale,
  storyPlaceholder,
}: {
  data: ResourcePatchIndexData;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  storyPlaceholder: string;
}) {
  const copy = serviceMessages[serviceLocale].patchChanges;
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(() => resourceKey(findInitialResource(data)));
  const [expandedGroups, setExpandedGroups] = useState<Set<StoryEntityType>>(() => new Set());
  const [allGroupsExpanded, setAllGroupsExpanded] = useState(false);
  const [allGroupsTooltipSuppressed, setAllGroupsTooltipSuppressed] = useState(false);
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
  const matchingGroups = useMemo(() => data.groups.flatMap((group) => {
    const resources = group.resources.filter((resource) => resourceMatches(resource, normalizedQuery));
    return resources.length > 0 ? [{ group, resources }] : [];
  }), [data.groups, normalizedQuery]);
  const visibleGroups = normalizedQuery || allGroupsExpanded
    ? matchingGroups
    : matchingGroups.slice(0, DEFAULT_VISIBLE_GROUP_COUNT);
  const canToggleAllGroups = !normalizedQuery && matchingGroups.length > DEFAULT_VISIBLE_GROUP_COUNT;
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

  useEffect(() => {
    const selectedGroupIndex = data.groups.findIndex((group) => group.type === selectedResource.type);
    if (selectedGroupIndex >= DEFAULT_VISIBLE_GROUP_COUNT) setAllGroupsExpanded(true);
  }, [data.groups, selectedResource.type]);

  const selectResource = (resource: ResourcePatchIndexResource) => {
    setSelectedKey(resourceKey(resource));
    const url = new URL(window.location.href);
    url.searchParams.set("type", resource.type);
    url.searchParams.set("id", resource.id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const toggleResourceGroup = (type: StoryEntityType) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const storyAction = (line: STS2PatchLine): ReactNode => {
    const staticCount = staticStoryCounts.get(line.id) ?? 0;
    const count = staticCount + (communityStoryCounts.get(line.id) ?? 0);
    return (
      <PatchLineStoryAction
        count={count}
        staticCount={staticCount}
        patchLine={line}
        serviceLocale={serviceLocale}
        storiesUnavailable={communityStories.unavailable}
        onOpen={() => setActivePatchLineId(line.id)}
        onWrite={() => setComposerPatchLineId(line.id)}
      />
    );
  };
  const selectedLabel = selectedResource.names?.[gameLocale]
    ?? (serviceLocale === "ko" ? selectedResource.nameKo : selectedResource.nameEn);

  return (
    <>
      <label className="relative mt-4 block max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="h-9 w-full rounded-md border border-white/10 bg-white/[0.035] pl-9 pr-3 font-game-text text-sm text-foreground outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500/35"
        />
      </label>

      <div className="mt-3 space-y-1">
        {visibleGroups.map(({ group, resources }) => (
          <ResourceGroupRow
            key={group.type}
            group={group}
            resources={resources}
            selectedResource={selectedResource}
            expanded={expandedGroups.has(group.type)}
            searching={Boolean(normalizedQuery)}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            moreLabel={copy.more}
            lessLabel={copy.less}
            onToggle={() => toggleResourceGroup(group.type)}
            onSelect={selectResource}
          />
        ))}
        {canToggleAllGroups && (
          <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-x-1.5 py-0.5">
            <div className="flex h-8 items-center justify-center">
              <button
                type="button"
                onClick={(event) => {
                  if (event.detail > 0) event.currentTarget.blur();
                  setAllGroupsTooltipSuppressed(true);
                  setAllGroupsExpanded((current) => !current);
                }}
                onPointerLeave={(event) => {
                  if (document.activeElement !== event.currentTarget) {
                    setAllGroupsTooltipSuppressed(false);
                  }
                }}
                onFocus={() => setAllGroupsTooltipSuppressed(false)}
                onBlur={() => setAllGroupsTooltipSuppressed(false)}
                aria-expanded={allGroupsExpanded}
                aria-label={allGroupsExpanded ? copy.less : copy.more}
                className="group/index-token relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-sky-950/20 text-sky-300/55 ring-1 ring-inset ring-sky-200/10 transition-colors hover:bg-sky-400/[0.07] hover:text-sky-200"
              >
                {allGroupsExpanded ? <Shrink size={15} /> : <EllipsisVertical size={17} />}
                <IndexTokenTooltip
                  title={allGroupsExpanded ? copy.less : copy.more}
                  suppressed={allGroupsTooltipSuppressed}
                />
              </button>
            </div>
          </div>
        )}
        {normalizedQuery && matchingGroups.length === 0 && (
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
            <p className="font-game-text text-xs text-gray-500">
              {copy.changeCount.replace("{count}", String(selectedResource.changeCount))}
            </p>
          </div>
        </div>
        {selectedLines.length > 0 ? (
          <ResourcePatchChangeList
            lines={selectedLines}
            patches={data.patches}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            trailingAction={storyAction}
          />
        ) : (
          <p className="py-8 text-center font-game-text text-sm text-gray-500">
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

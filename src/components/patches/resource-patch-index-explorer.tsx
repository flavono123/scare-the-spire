"use client";

import Image from "@/components/ui/static-image";
import { CircleHelp, Ellipsis, Search, Shrink } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  type ResourcePatchIndexResource,
} from "@/lib/resource-patch-index";
import { sts2NavItems } from "@/lib/site-nav-items";
import type { STS2PatchLine, Story, StoryEntityType } from "@/lib/types";
import { serviceMessages } from "@/messages/service";

const PRIMARY_RESOURCE_COUNT = 5;

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
  encounter: navIcon("monsters"),
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
  icon,
  children,
}: {
  title: string;
  icon: string;
  children?: ReactNode;
}) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-50 hidden -translate-x-1/2 pt-2 group-hover/index-token:block group-focus-within/index-token:block">
      <GameHoverTip
        title={title}
        icon={icon}
        style={{ minWidth: 160, maxWidth: "min(240px, calc(100vw - 24px))" }}
      >
        {children}
      </GameHoverTip>
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
      <IndexTokenTooltip title={label} icon={icon} />
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
      aria-label={`${label} · ${resource.changeCount}`}
      className={`group/index-token relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
        selected
          ? "bg-yellow-500/10 ring-1 ring-inset ring-yellow-300/35 shadow-[0_0_14px_rgba(234,179,8,0.12)]"
          : "hover:bg-white/[0.055]"
      }`}
    >
      {resource.imageUrl ? (
        <Image
          src={resource.imageUrl}
          alt=""
          width={28}
          height={28}
          className={`h-7 w-7 object-contain transition-transform group-hover/index-token:scale-110 ${
            selected ? "drop-shadow-[0_0_5px_rgba(234,179,8,0.35)]" : ""
          }`}
        />
      ) : (
        <CircleHelp size={17} className="text-zinc-600" />
      )}
      <IndexTokenTooltip title={label} icon={resource.imageUrl ?? RESOURCE_GROUP_ICON[resource.type]}>
        <span className="block text-sm text-[#d6cdbf]">
          {resourceGroupLabel(resource.type, serviceLocale)}
          <span className="mx-1.5 text-white/35">·</span>
          {serviceMessages[serviceLocale].patchChanges.changeCount.replace(
            "{count}",
            String(resource.changeCount),
          )}
        </span>
      </IndexTokenTooltip>
    </button>
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

      <div className="mt-3 flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2">
        {data.groups.map((group) => {
          const filtered = group.resources.filter((resource) => resourceMatches(resource, normalizedQuery));
          if (normalizedQuery && filtered.length === 0) return null;
          const expanded = expandedGroups.has(group.type);
          const visible = normalizedQuery || expanded || group.type === "character"
            ? filtered
            : filtered.slice(0, PRIMARY_RESOURCE_COUNT);
          const canExpand = !normalizedQuery && group.type !== "character" && filtered.length > PRIMARY_RESOURCE_COUNT;
          return (
            <section
              key={group.type}
              aria-label={resourceGroupLabel(group.type, serviceLocale)}
              className="inline-flex min-w-0 flex-wrap items-center gap-0.5 rounded-lg bg-white/[0.018] p-0.5"
            >
              <ResourceGroupToken
                type={group.type}
                active={selectedResource.type === group.type}
                serviceLocale={serviceLocale}
              />
              <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-white/[0.08]" />
              <div className="flex min-w-0 flex-wrap items-center gap-0.5">
                {visible.map((resource) => (
                  <ResourceToken
                    key={resourceKey(resource)}
                    resource={resource}
                    selected={resourceKey(resource) === resourceKey(selectedResource)}
                    serviceLocale={serviceLocale}
                    gameLocale={gameLocale}
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
                    aria-label={expanded ? copy.less : copy.more}
                    className="group/index-token relative inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-300/55 transition-colors hover:bg-sky-400/[0.07] hover:text-sky-200"
                  >
                    {expanded ? <Shrink size={16} /> : <Ellipsis size={17} />}
                    <IndexTokenTooltip
                      title={expanded ? copy.less : copy.more}
                      icon={RESOURCE_GROUP_ICON[group.type]}
                    />
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

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { FilterSection } from "@/components/codex/codex-filters";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { sts1DetailPath, sts1EventImageUrl } from "@/lib/sts1/paths";
import type { Sts1EntityRefs, Sts1Event, Sts1EventGroup, Sts1EventLabels, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1EventArt, Sts1EventDetail } from "./event-detail";
import { CompendiumLayoutSwitcher, useCompendiumLayout } from "@/components/codex/view-switcher";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import {
  Sts1DetailModal,
  Sts1ListLayout,
  filterButtonClass,
  openOnPlainClick,
  toggled,
  useSts1Selection,
} from "./list-shell";

const GROUP_ORDER: Sts1EventGroup[] = ["exordium", "city", "beyond", "special", "shrine"];
const SECTION_ORDER: Sts1EventGroup[] = ["exordium", "city", "beyond", "shrine", "special"];

function inGroup(event: Sts1Event, group: Sts1EventGroup): boolean {
  if (group === "shrine" || group === "special") return event.groups.includes(group);
  return event.dungeons.includes(group);
}

/** Where the list shows an event: its act's event list, else the shrine or shared list. */
function sectionOf(event: Sts1Event): Sts1EventGroup {
  return event.groups.find((group) => group === "exordium" || group === "city" || group === "beyond")
    ?? (event.groups.includes("shrine") ? "shrine" : event.groups.includes("special") ? "special" : event.dungeons[0] as Sts1EventGroup);
}

export function Sts1EventTile({ event, refs }: { event: Sts1Event; refs: Sts1EntityRefs }) {
  return (
    <div className="flex flex-col items-center gap-2 transition-transform group-hover:-translate-y-0.5">
      <Sts1EventArt image={event.image} monsters={event.artMonsters} refs={refs} sizes="220px" />
      <span className="text-center font-game-title text-sm text-gray-100 group-hover:text-[#efc851]">{event.name}</span>
    </div>
  );
}

/** The STS2 events list row: the picture faded behind the name, acts on the right. */
function Sts1EventRow({ event, refs, eventLabels }: { event: Sts1Event; refs: Sts1EntityRefs; eventLabels: Sts1EventLabels }) {
  const firstMonster = event.artMonsters.map((id) => refs.monster[id]).find(Boolean);
  const art = event.image ? sts1EventImageUrl(event.image) : firstMonster?.imageUrl;
  return (
    <div className="relative block h-[72px] w-full overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-900/80 shadow-sm shadow-black/20 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-white/[0.04]">
      {art ? (
        <div className="absolute inset-0">
          <Image src={art} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" loading="lazy" className="object-cover object-[30%_center] opacity-40 transition-all duration-300 group-hover:scale-[1.03] group-hover:opacity-65" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/60 to-black/80" />
        </div>
      ) : null}
      <div className="relative flex h-full items-center gap-3 px-4">
        <h3 className="min-w-0 flex-1 truncate font-game-title text-sm font-semibold text-zinc-100 transition-colors group-hover:text-primary">{event.name}</h3>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {event.dungeons.filter((dungeon) => dungeon !== "ending").map((dungeon) => (
            <span key={dungeon} className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-game-text text-[10px] text-blue-300">
              {eventLabels.dungeons[dungeon].act}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export function Sts1EventLibrary({
  events,
  refs,
  related,
  labels,
  eventLabels,
  serviceLocale,
}: {
  events: Sts1Event[];
  refs: Sts1EntityRefs;
  related?: Record<string, Sts1RelatedGroup[]>;
  labels: Sts1UiLabels;
  eventLabels: Sts1EventLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const [layout, setLayout] = useCompendiumLayout("gallery");
  const { selected, open, close } = useSts1Selection(events, "event");
  const [groups, setGroups] = useState<Set<Sts1EventGroup>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const sortLocale = serviceLocale === "ko" ? "ko" : "en";
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return events.filter((event) => {
      if (groups.size && ![...groups].some((group) => inGroup(event, group))) return false;
      if (query && !fuzzyMatchCodexText(`${event.name} ${event.nameEn} ${event.id}`, query)) return false;
      return true;
    });
  }, [events, groups, searchQuery]);

  return (
    <Sts1ListLayout
      trailing={<CompendiumLayoutSwitcher layout={layout} onChange={setLayout} serviceLocale={serviceLocale} />}
      title={eventLabels.title}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      filters={(
        <FilterSection label={serviceLocale === "ko" ? "분류" : "Pool"}>
          <div className="flex flex-col gap-0.5">
            {GROUP_ORDER.map((group) => (
              <button key={group} onClick={() => setGroups((previous) => toggled(previous, group))} className={filterButtonClass(groups.has(group))}>
                {eventLabels.groups[group]}
              </button>
            ))}
          </div>
        </FilterSection>
      )}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <Sts1EventDetail
            event={selected}
            refs={refs}
            related={related?.[selected.slug]}
            labels={labels}
            eventLabels={eventLabels}
            serviceLocale={serviceLocale}
            onClose={close}
          />
        </Sts1DetailModal>
      ) : null}
    >
      {SECTION_ORDER.filter((section) => filtered.some((event) => sectionOf(event) === section)).map((section) => {
        const group = filtered
          .filter((event) => sectionOf(event) === section)
          .sort((left, right) => left.name.localeCompare(right.name, sortLocale));
        return (
          <section key={section} className="mb-8 last:mb-0">
            <h2 className="mb-3 font-game-title text-lg font-bold text-primary">
              {eventLabels.groups[section]}
              <span className="ml-2 font-game-text text-sm font-normal text-gray-400">{group.length}</span>
            </h2>
            <div className={layout === "gallery" ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" : "space-y-2"}>
              {group.map((event) => (
                <Link
                  key={event.slug}
                  prefetch={false}
                  href={localizeLink(sts1DetailPath("events", event.slug))}
                  className="group"
                  aria-label={event.name}
                  onClick={(clickEvent) => openOnPlainClick(clickEvent, () => open(event))}
                >
                  {layout === "gallery" ? <Sts1EventTile event={event} refs={refs} /> : <Sts1EventRow event={event} refs={refs} eventLabels={eventLabels} />}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </Sts1ListLayout>
  );
}

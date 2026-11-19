"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { FilterSection } from "@/components/codex/codex-filters";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { sts1DetailPath, sts1EventImageUrl, sts1EventUiUrl } from "@/lib/sts1/paths";
import type { Sts1EntityRefs, Sts1Event, Sts1EventGroup, Sts1EventLabels, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1EventDetail } from "./event-detail";
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

export function Sts1EventTile({ event }: { event: Sts1Event }) {
  return (
    <div className="flex flex-col items-center gap-2 transition-transform group-hover:-translate-y-0.5">
      <div className="relative aspect-square w-full">
        {event.image ? (
          <Image
            src={sts1EventImageUrl(event.image)}
            alt=""
            fill
            className={`${event.image.endsWith(".png") ? "object-contain p-[8%]" : "object-cover p-[3.5%]"}`}
            sizes="220px"
          />
        ) : (
          <div className="absolute inset-[3.5%] bg-black/60" />
        )}
        <Image src={sts1EventUiUrl("imgFrame")} alt="" fill className="pointer-events-none object-fill" sizes="220px" />
      </div>
      <span className="text-center font-game-title text-sm text-gray-100 group-hover:text-[#efc851]">{event.name}</span>
    </div>
  );
}

export function Sts1EventLibrary({
  events,
  refs,
  labels,
  eventLabels,
  serviceLocale,
}: {
  events: Sts1Event[];
  refs: Sts1EntityRefs;
  labels: Sts1UiLabels;
  eventLabels: Sts1EventLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {group.map((event) => (
                <Link
                  key={event.slug}
                  prefetch={false}
                  href={localizeLink(sts1DetailPath("events", event.slug))}
                  className="group"
                  aria-label={event.name}
                  onClick={(clickEvent) => openOnPlainClick(clickEvent, () => open(event))}
                >
                  <Sts1EventTile event={event} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </Sts1ListLayout>
  );
}

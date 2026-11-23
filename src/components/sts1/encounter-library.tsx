"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1Encounter, Sts1EncounterMonster, Sts1EncounterPool } from "@/lib/sts1/encounters";
import { sts1DetailPath, sts1IndexPath } from "@/lib/sts1/paths";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import type { Sts1Dungeon, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1DetailShell, Sts1EnglishName, Sts1InfoRailSection, Sts1MetaPill } from "./detail-chrome";
import { Sts1DetailModal, Sts1ListLayout, useSts1Selection } from "./list-shell";
import { Sts1RelatedRail } from "./related-rail";

const DUNGEONS: Sts1Dungeon[] = ["exordium", "city", "beyond", "ending"];
const POOLS: Exclude<Sts1EncounterPool, "event">[] = ["weak", "strong", "elite", "boss"];

function text(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        pools: { weak: "약한 적", strong: "강한 적", elite: "엘리트", boss: "보스", event: "이벤트" },
        unused: "쓰이지 않는 조우",
        composition: "구성",
        pick: (count: number) => `무작위 ${count}`,
        repeat: "중복 가능",
        or: "또는",
        weight: "가중치",
        startedBy: "시작하는 이벤트",
      }
    : {
        pools: { weak: "Weak", strong: "Strong", elite: "Elite", boss: "Boss", event: "Event" },
        unused: "Unused encounters",
        composition: "Composition",
        pick: (count: number) => `${count} at random`,
        repeat: "repeats allowed",
        or: "or",
        weight: "Weight",
        startedBy: "Started by",
      };
}

function MonsterChip({ monster, size = 40 }: { monster: Sts1EncounterMonster; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-end" title={monster.name}>
      <Image src={monster.imageUrl} alt={monster.name} width={size} height={size} className="object-contain" style={{ width: size, height: size }} />
      {monster.count > 1 ? (
        <span className="absolute -bottom-0.5 -right-1 font-game-title text-xs font-black text-[#fff8db] [text-shadow:0_1px_0_#000,0_0_3px_#000]">×{monster.count}</span>
      ) : null}
    </span>
  );
}

/** Every monster the encounter can field, fixed ones first, for the list thumbnail strip. */
function encounterFaces(encounter: Sts1Encounter): Sts1EncounterMonster[] {
  const seen = new Set<string>();
  return [...encounter.monsters, ...encounter.variants.flat(), ...encounter.choices.flatMap((choice) => choice.from)]
    .filter((monster) => (seen.has(monster.slug) ? false : (seen.add(monster.slug), true)));
}

function Composition({ encounter, labels, monsterLink }: { encounter: Sts1Encounter; labels: ReturnType<typeof text>; monsterLink: (monster: Sts1EncounterMonster) => ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {encounter.monsters.length ? <div className="flex flex-wrap items-end gap-3">{encounter.monsters.map(monsterLink)}</div> : null}
      {encounter.variants.length ? (
        <div className="flex flex-wrap items-end gap-3">
          {encounter.variants.map((variant, index) => (
            <span key={index} className="inline-flex items-end gap-2">
              {index > 0 ? <span className="pb-3 font-game-text text-xs text-gray-400">{labels.or}</span> : null}
              {variant.map(monsterLink)}
            </span>
          ))}
        </div>
      ) : null}
      {encounter.choices.map((choice, index) => (
        <div key={index}>
          <div className="mb-1 font-game-text text-xs text-gray-400">
            {labels.pick(choice.pick)}{choice.independent ? ` · ${labels.repeat}` : ""}
          </div>
          <div className="flex flex-wrap items-end gap-3">{choice.from.map(monsterLink)}</div>
        </div>
      ))}
    </div>
  );
}

function EncounterDetail({
  encounter,
  related,
  labels,
  serviceLocale,
  onClose,
}: {
  encounter: Sts1Encounter;
  related: readonly Sts1RelatedGroup[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose: () => void;
}) {
  const localizeLink = useLocalizedHref();
  const t = text(serviceLocale);
  const monsterLink = (monster: Sts1EncounterMonster) => (
    <Link key={monster.slug} prefetch={false} href={localizeLink(sts1DetailPath("monsters", monster.slug))} className="flex flex-col items-center gap-1 hover:brightness-125">
      <MonsterChip monster={monster} size={72} />
      <span className="max-w-[6rem] truncate font-game-text text-xs text-gray-200">{monster.name}</span>
    </Link>
  );
  return (
    <Sts1DetailShell
      backHref={`${sts1IndexPath("monsters")}?view=encounters`}
      backLabel={labels.monstersTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={(
        <div className="flex w-full flex-col items-center gap-4">
          <Composition encounter={encounter} labels={t} monsterLink={monsterLink} />
          <h1 className="text-center font-game-title text-3xl text-[#fff6e2] [text-shadow:0_2px_0_#000]">{encounter.name}</h1>
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {encounter.dungeons.map((dungeon) => (
            <Sts1MetaPill key={dungeon} value={`${labels.monsters.dungeons[dungeon].act} ${labels.monsters.dungeons[dungeon].name}`} />
          ))}
          {encounter.pools.map((pool) => <Sts1MetaPill key={pool} value={t.pools[pool]} />)}
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={encounter.name} nameEn={encounter.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      {Object.keys(encounter.weights).length ? (
        <Sts1InfoRailSection title={t.weight}>
          <dl className="flex flex-col gap-1 font-game-text text-sm">
            {Object.entries(encounter.weights).map(([key, weight]) => {
              const [dungeon, pool] = key.split(":") as [Sts1Dungeon, Sts1EncounterPool];
              return (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="text-gray-400">{labels.monsters.dungeons[dungeon]?.act} {t.pools[pool]}</dt>
                  <dd className="font-bold text-gray-100">{weight}</dd>
                </div>
              );
            })}
          </dl>
        </Sts1InfoRailSection>
      ) : null}
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

/** MonsterHelper's encounters by act and list (weak, strong, elite, boss), then event-only and unused keys. */
export function Sts1EncounterLibrary({
  encounters,
  related,
  labels,
  serviceLocale,
  trailing,
}: {
  encounters: Sts1Encounter[];
  related?: Record<string, Sts1RelatedGroup[]>;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  trailing?: ReactNode;
}) {
  const t = text(serviceLocale);
  const { selected, open, close } = useSts1Selection(encounters, "encounter");
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return encounters.filter((row) => !query || fuzzyMatchCodexText(`${row.name} ${row.nameEn} ${row.key} ${encounterFaces(row).map((monster) => monster.name).join(" ")}`, query));
  }, [encounters, searchQuery]);
  const sections = [
    ...DUNGEONS.flatMap((dungeon) => POOLS.map((pool) => ({
      key: `${dungeon}-${pool}`,
      title: `${labels.monsters.dungeons[dungeon].act} ${labels.monsters.dungeons[dungeon].name} · ${t.pools[pool]}`,
      rows: filtered.filter((row) => row.dungeons.includes(dungeon) && row.pools.includes(pool)),
    }))),
    { key: "event", title: t.pools.event, rows: filtered.filter((row) => !row.dungeons.length && row.pools.includes("event")) },
    { key: "unused", title: t.unused, rows: filtered.filter((row) => !row.pools.length) },
  ].filter((section) => section.rows.length);
  return (
    <Sts1ListLayout
      title={labels.monstersTitle}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      trailing={trailing}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <EncounterDetail encounter={selected} related={related?.[selected.slug] ?? []} labels={labels} serviceLocale={serviceLocale} onClose={close} />
        </Sts1DetailModal>
      ) : null}
    >
      {sections.map((section) => (
        <section key={section.key} className="mb-8 last:mb-0">
          <h2 className="mb-3 font-game-title text-lg font-bold text-primary">
            {section.title}
            <span className="ml-2 font-game-text text-sm font-normal text-gray-400">{section.rows.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {section.rows.map((row) => (
              <button
                key={row.slug}
                type="button"
                onClick={() => open(row)}
                className="flex items-center gap-3 rounded-md border border-border bg-compendium-rail px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-white/[0.04]"
                data-sts1-encounter={row.slug}
              >
                <span className="flex shrink-0 items-end gap-0.5">
                  {encounterFaces(row).slice(0, 4).map((monster) => <MonsterChip key={monster.slug} monster={monster} size={36} />)}
                </span>
                <span className="min-w-0 truncate font-game-title text-sm text-gray-100">{row.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </Sts1ListLayout>
  );
}

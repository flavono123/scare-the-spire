"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { useMonsterAscensionLevel } from "@/components/codex/monster-ascension";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_MONSTER_ASCENSION_SCOPE } from "@/lib/sts1/monster-moves";
import { sts1IndexPath, sts1UiImageUrl } from "@/lib/sts1/paths";
import type { Sts1Ascension, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1EventText } from "./event-text";
import { Sts1ListLayout } from "./list-shell";
import { Sts1TipBox } from "./tip-box";

/** The top panel's ascension badge with the level on it, as the stepper draws it. */
export function Sts1AscensionBadge({ level, size }: { level: number; size: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <Image src={sts1UiImageUrl("ascension")} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />
      <span
        className="absolute inset-0 flex items-center justify-center pt-px font-game-title font-black text-white"
        style={{ fontSize: size * 0.36, textShadow: "0 2px 0 #000, 0 0 4px #000" }}
      >
        {level}
      </span>
    </span>
  );
}

export function Sts1AscensionList({
  ascensions,
  labels,
  serviceLocale,
}: {
  ascensions: Sts1Ascension[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const [, setLevel] = useMonsterAscensionLevel(STS1_MONSTER_ASCENSION_SCOPE);
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return ascensions.filter((row) => !query || fuzzyMatchCodexText(`${row.level} ${row.description}`, query));
  }, [ascensions, searchQuery]);
  return (
    <Sts1ListLayout
      title={labels.listTitles.ascensions}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {filtered.map((row) => (
          // The bestiary opens at this level: the stepper's stored level is the one it reads.
          <Link
            key={row.level}
            prefetch={false}
            href={localizeLink(sts1IndexPath("monsters"))}
            onClick={() => setLevel(row.level)}
            className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            data-sts1-ascension={row.level}
            id={`ascension-${row.level}`}
          >
            <span className="flex justify-center"><Sts1AscensionBadge level={row.level} size={64} /></span>
            <Sts1TipBox
              title={`${labels.monsters.ascension} ${row.level}`}
              className="transition-[filter] group-hover:brightness-110"
            >
              <Sts1EventText text={row.description} />
              {row.monsterStats ? (
                <span className="mt-1 block text-[11px] text-[#87ceeb] group-hover:underline">→ {labels.monstersTitle}</span>
              ) : null}
            </Sts1TipBox>
          </Link>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-3xl">
        <Sts1CommentsRail resourceType="ascension" slug="list" serviceLocale={serviceLocale} />
      </div>
    </Sts1ListLayout>
  );
}

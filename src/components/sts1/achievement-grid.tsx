"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { sts1AchievementImageUrl, sts1CharacterIconUrl } from "@/lib/sts1/paths";
import type { Sts1Achievement, Sts1CharacterId, Sts1EntityRefs, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1EventText } from "./event-text";
import { Sts1ListLayout } from "./list-shell";
import { Sts1MentionHover } from "./mention-hover";
import { Sts1EntityToken } from "./ref-token";
import { Sts1TipBox } from "./tip-box";

function RefTokens({ achievement, refs, labels }: { achievement: Sts1Achievement; refs: Sts1EntityRefs; labels: Sts1UiLabels }) {
  return (
    <span className="mt-2 flex flex-wrap gap-1">
      {achievement.refs.map((ref) => {
        if (ref.type === "character") {
          const id = ref.id as Sts1CharacterId;
          return (
            <span key={`character-${id}`} className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5">
              <Sts1MentionHover
                entityId={`sts1:characters:${id}`}
                text={labels.characters[id]}
                className="relative inline-flex cursor-help items-center"
                linkClassName="inline-flex items-center gap-1 font-game-text text-xs font-semibold text-[#efc851] no-underline hover:brightness-125"
              >
                <Image src={sts1CharacterIconUrl(id)} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                {labels.characters[id]}
              </Sts1MentionHover>
            </span>
          );
        }
        return <Sts1EntityToken key={`${ref.type}-${ref.id}`} type={ref.type} id={ref.id} refs={refs} />;
      })}
    </span>
  );
}

function AchievementTile({ achievement, refs, labels }: { achievement: Sts1Achievement; refs: Sts1EntityRefs; labels: Sts1UiLabels }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="group relative flex flex-col items-center gap-1.5 text-center outline-none"
      tabIndex={0}
      data-sts1-achievement={achievement.key}
      id={achievement.slug}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <Image
        src={sts1AchievementImageUrl(achievement.image)}
        alt=""
        width={112}
        height={112}
        className="h-24 w-24 object-contain transition-transform group-hover:scale-105 sm:h-28 sm:w-28"
      />
      <span className="font-game-title text-sm font-bold text-[#efc851]">{achievement.name}</span>
      <span className="font-game-text text-xs leading-snug text-gray-300">{achievement.description}</span>
      {hovered ? (
        <PortaledHoverTipLayer pin="top-left" interactive>
          <Sts1TipBox title={achievement.name} className="w-72">
            <Sts1EventText text={achievement.description} />
            {achievement.refs.length ? <RefTokens achievement={achievement} refs={refs} labels={labels} /> : null}
          </Sts1TipBox>
        </PortaledHoverTipLayer>
      ) : null}
    </div>
  );
}

/** StatsScreen's achievement grid: unlocked art, name and condition; hovering adds what it names. */
export function Sts1AchievementGrid({
  achievements,
  refs,
  labels,
  serviceLocale,
}: {
  achievements: Sts1Achievement[];
  refs: Sts1EntityRefs;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return achievements.filter((row) => !query || fuzzyMatchCodexText(`${row.name} ${row.description} ${row.key}`, query));
  }, [achievements, searchQuery]);
  return (
    <Sts1ListLayout
      title={labels.listTitles.achievements}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
        {filtered.map((achievement) => (
          <AchievementTile key={achievement.key} achievement={achievement} refs={refs} labels={labels} />
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-5xl">
        <Sts1CommentsRail resourceType="achievement" slug="list" serviceLocale={serviceLocale} />
      </div>
    </Sts1ListLayout>
  );
}

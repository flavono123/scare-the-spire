"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { sts1AchievementImageUrl, sts1DetailPath, sts1IndexPath } from "@/lib/sts1/paths";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import type { Sts1Achievement, Sts1EntityRefs, Sts1Keyword, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1HeroTip } from "./detail-chrome";
import { Sts1EventText } from "./event-text";
import { Sts1DetailModal, Sts1ListLayout, openOnPlainClick, useSts1Selection } from "./list-shell";
import { Sts1RelatedRail } from "./related-rail";
import { Sts1TipBox } from "./tip-box";

export function Sts1AchievementDetail({
  achievement,
  refs,
  related = [],
  keywords = [],
  labels,
  serviceLocale,
  onClose,
}: {
  achievement: Sts1Achievement;
  refs: Sts1EntityRefs;
  related?: readonly Sts1RelatedGroup[];
  keywords?: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("achievements")}
      backLabel={labels.listTitles.achievements}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      assetActions={<CompendiumAssetImageActions serviceLocale={serviceLocale} fileName={`${achievement.slug}.png`} targetRef={captureRef} />}
      hero={(
        <div className="flex w-full flex-col items-center gap-4">
          <div ref={captureRef}>
            <Image src={sts1AchievementImageUrl(achievement.image)} alt={achievement.name} width={192} height={192} className="h-44 w-44 object-contain sm:h-48 sm:w-48" />
          </div>
          <Sts1HeroTip title={achievement.name} description={achievement.description} keywords={keywords} refs={refs} className="w-full max-w-[22rem]" />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1EnglishName name={achievement.name} nameEn={achievement.nameEn} serviceLocale={serviceLocale} />
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="achievement" slug={achievement.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

function AchievementTile({ achievement, onOpen }: { achievement: Sts1Achievement; onOpen: () => void }) {
  const localizeLink = useLocalizedHref();
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      prefetch={false}
      href={localizeLink(sts1DetailPath("achievements", achievement.slug))}
      onClick={(event) => openOnPlainClick(event, onOpen)}
      className="group relative flex flex-col items-center gap-1.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      data-sts1-achievement={achievement.key}
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
      <Sts1EventText text={achievement.description} className="font-game-text text-xs leading-snug text-gray-300" />
      {hovered ? (
        <PortaledHoverTipLayer pin="top-left">
          <Sts1TipBox title={achievement.name} className="w-72">
            <Sts1EventText text={achievement.description} />
          </Sts1TipBox>
        </PortaledHoverTipLayer>
      ) : null}
    </Link>
  );
}

/** StatsScreen's achievement grid: unlocked art, name and condition, the game's tip on hover. */
export function Sts1AchievementGrid({
  achievements,
  refs,
  related,
  keywords,
  labels,
  serviceLocale,
}: {
  achievements: Sts1Achievement[];
  refs: Sts1EntityRefs;
  related?: Record<string, Sts1RelatedGroup[]>;
  keywords?: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const { selected, open, close } = useSts1Selection(achievements, "achievement");
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return achievements.filter((row) => !query || fuzzyMatchCodexText(`${row.name} ${row.nameEn} ${row.description} ${row.key}`, query));
  }, [achievements, searchQuery]);
  return (
    <Sts1ListLayout
      title={labels.listTitles.achievements}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <Sts1AchievementDetail
            achievement={selected}
            refs={refs}
            related={related?.[selected.slug]}
            keywords={keywords}
            labels={labels}
            serviceLocale={serviceLocale}
            onClose={close}
          />
        </Sts1DetailModal>
      ) : null}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
        {filtered.map((achievement) => (
          <AchievementTile key={achievement.key} achievement={achievement} onOpen={() => open(achievement)} />
        ))}
      </div>
    </Sts1ListLayout>
  );
}

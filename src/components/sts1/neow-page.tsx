"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import { FilterSection } from "@/components/codex/codex-filters";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1NeowData } from "@/lib/sts1/compendium-extras";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1EventUiUrl, sts1NpcImageUrl } from "@/lib/sts1/paths";
import type { Sts1EntityRefs, Sts1Monster, Sts1NeowReward, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1EventText } from "./event-text";
import { Sts1ListLayout, filterButtonClass, toggled } from "./list-shell";
import { Sts1MonsterStage } from "./monster-stage";
import { Sts1ItemRefTokens } from "./ref-token";

/** The game names none of these: `slots` are the four buttons by position, `mini` the two-choice blessing. */
type NeowLabels = { filter: string; slots: string[]; mini: string };

type NeowRow = { key: string; label: string; rewards: Sts1NeowReward[]; tags: string[] };

/** A LargeDialogOptionButton as NeowEvent shows it: the ribbon, tinted until hovered. */
function NeowOption({ label, rewards, refs, tags }: { label: string; rewards: Sts1NeowReward[]; refs: Sts1EntityRefs; tags: string[] }) {
  const items = rewards.flatMap((reward) => reward.refs);
  return (
    <div className="group relative transition-transform hover:translate-x-1" data-sts1-neow-option="">
      <Image
        src={sts1EventUiUrl("enabledButton")}
        alt=""
        fill
        className="pointer-events-none object-fill brightness-[0.4] transition-[filter] group-hover:brightness-100"
        sizes="560px"
      />
      <div className="relative px-5 py-2.5">
        <Sts1EventText text={label} className="block font-game-text text-sm leading-snug text-[#cccccc] [text-shadow:0_1px_0_#000] group-hover:text-white" />
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <span key={tag} className="rounded border border-white/15 px-1.5 py-px font-game-text text-[10px] text-gray-300">{tag}</span>
          ))}
          {items.map((item, index) => <Sts1ItemRefTokens key={index} item={item} refs={refs} />)}
        </div>
      </div>
    </div>
  );
}

export function Sts1NeowPage({
  neow,
  stage,
  refs,
  neowLabels,
  labels,
  serviceLocale,
}: {
  neow: Sts1NeowData;
  stage: Sts1Monster;
  refs: Sts1EntityRefs;
  neowLabels: NeowLabels;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  // One row per button the game can show; category 2 is the rolled drawback then the reward (NeowReward label rule).
  const rows = useMemo(() => {
    const out: NeowRow[] = neow.categories.flatMap((category) => (category.index === 2
      ? category.drawbacks.flatMap((drawback) => category.rewards
        .filter((reward) => !neow.excluded[drawback.type]?.includes(reward.type))
        .map((reward) => ({ key: `${drawback.type}-${reward.type}`, label: `${drawback.label}${reward.label}`, rewards: [drawback, reward], tags: ["c2"] })))
      : category.rewards.map((reward) => ({ key: reward.type, label: reward.label, rewards: [reward], tags: [`c${category.index}`] }))));
    // The mini blessing's two rewards are also on the second button: tag those rows instead of listing them twice.
    for (const reward of neow.mini) {
      const row = out.find((candidate) => candidate.key === reward.type);
      if (row) row.tags.push("mini");
      else out.push({ key: `mini-${reward.type}`, label: reward.label, rewards: [reward], tags: ["mini"] });
    }
    return out;
  }, [neow]);
  const tags = [...neow.categories.map((category) => ({ key: `c${category.index}`, label: neowLabels.slots[category.index] ?? String(category.index + 1) })), { key: "mini", label: neowLabels.mini }];
  const tagLabel = Object.fromEntries(tags.map((tag) => [tag.key, tag.label]));
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return rows.filter((row) => (!tagFilter.size || row.tags.some((tag) => tagFilter.has(tag)))
      && (!query || fuzzyMatchCodexText(plainSts1Text(row.label), query)));
  }, [rows, searchQuery, tagFilter]);
  return (
    <Sts1ListLayout
      title={labels.listTitles.neow}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      filters={(
        <FilterSection label={neowLabels.filter}>
          <div className="flex flex-col gap-0.5">
            {tags.map((tag) => (
              <button key={tag.key} onClick={() => setTagFilter((previous) => toggled(previous, tag.key))} className={filterButtonClass(tagFilter.has(tag.key))}>
                {tag.label}
              </button>
            ))}
          </div>
        </FilterSection>
      )}
    >
      <div id="neow" className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="lg:sticky lg:top-4">
          <div className="relative mx-auto aspect-[808/712] w-full max-w-md">
            <Sts1MonsterStage monster={stage} playback={null} variant="tile" stillUrl={sts1NpcImageUrl("neow")} className="absolute inset-0" />
          </div>
          <Sts1EventText
            text={neow.greeting}
            className="mt-3 block text-center font-game-title text-xl text-[#fff6e2] [text-shadow:0_2px_0_#000]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {filtered.map((row) => (
            <NeowOption key={row.key} label={row.label} rewards={row.rewards} refs={refs} tags={row.tags.map((tag) => tagLabel[tag])} />
          ))}
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-6xl">
        <Sts1CommentsRail resourceType="neow" slug="list" serviceLocale={serviceLocale} />
      </div>
    </Sts1ListLayout>
  );
}

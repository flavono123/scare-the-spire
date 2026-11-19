"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1NeowData } from "@/lib/sts1/compendium-extras";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1EventUiUrl, sts1NpcImageUrl } from "@/lib/sts1/paths";
import type { Sts1EntityRefs, Sts1Monster, Sts1NeowReward, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1EventText } from "./event-text";
import { Sts1ListLayout } from "./list-shell";
import { Sts1MonsterStage } from "./monster-stage";
import { Sts1ItemRefTokens } from "./ref-token";

type NeowLabels = { categories: string[]; mini: string };

/** A LargeDialogOptionButton as NeowEvent shows it: the ribbon, tinted until hovered. */
function NeowOption({ label, rewards, refs }: { label: string; rewards: Sts1NeowReward[]; refs: Sts1EntityRefs }) {
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
        {items.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {items.map((item, index) => <Sts1ItemRefTokens key={index} item={item} refs={refs} />)}
          </div>
        ) : null}
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
  // Category 2 shows the rolled drawback and then the reward on one button (NeowReward label rule).
  const groups = useMemo(() => {
    const rows = neow.categories.map((category) => ({
      key: `c${category.index}`,
      title: neowLabels.categories[category.index] ?? String(category.index),
      options: category.index === 2
        ? category.drawbacks.flatMap((drawback) => category.rewards
          .filter((reward) => !neow.excluded[drawback.type]?.includes(reward.type))
          .map((reward) => ({ key: `${drawback.type}-${reward.type}`, label: `${drawback.label}${reward.label}`, rewards: [drawback, reward] })))
        : category.rewards.map((reward) => ({ key: reward.type, label: reward.label, rewards: [reward] })),
    }));
    rows.push({
      key: "mini",
      title: neowLabels.mini,
      options: neow.mini.map((reward) => ({ key: `mini-${reward.type}`, label: reward.label, rewards: [reward] })),
    });
    const query = searchQuery.trim();
    return rows
      .map((row) => ({ ...row, options: row.options.filter((option) => !query || fuzzyMatchCodexText(plainSts1Text(option.label), query)) }))
      .filter((row) => row.options.length > 0);
  }, [neow, neowLabels, searchQuery]);
  const count = groups.reduce((sum, group) => sum + group.options.length, 0);
  return (
    <Sts1ListLayout
      title={labels.listTitles.neow}
      count={count}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
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
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 font-game-title text-lg font-bold text-primary">
                {group.title}
                <span className="ml-2 font-game-text text-sm font-normal text-gray-400">{group.options.length}</span>
              </h2>
              <div className="flex flex-col gap-1.5">
                {group.options.map((option) => (
                  <NeowOption key={option.key} label={option.label} rewards={option.rewards} refs={refs} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-6xl">
        <Sts1CommentsRail resourceType="neow" slug="list" serviceLocale={serviceLocale} />
      </div>
    </Sts1ListLayout>
  );
}

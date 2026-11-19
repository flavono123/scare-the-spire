"use client";

import { useMemo, useState } from "react";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1ScoreBonusRow } from "@/lib/sts1/compendium-extras";
import type { Sts1EntityRefs, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1ListLayout } from "./list-shell";
import { Sts1EntityToken } from "./ref-token";

type ScoreLabels = { title: string; death: string; victory: string; unused: string };

/** GameOverScreen's stat line: name, then the points right-aligned in gold. */
function ScoreLine({ row, labels, refs }: { row: Sts1ScoreBonusRow; labels: ScoreLabels; refs: Sts1EntityRefs }) {
  return (
    <li className="flex items-start gap-3 border-b border-white/5 py-2 last:border-b-0" data-sts1-score={row.slug}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-game-title text-base text-[#fff6e2] [text-shadow:0_2px_0_#000]">{row.name}</span>
          {row.screens.length === 1 ? (
            <span className="rounded border border-[#7fff00]/40 px-1.5 py-px font-game-text text-[10px] text-[#7fff00]">
              {row.screens[0] === "victory" ? labels.victory : labels.death}
            </span>
          ) : null}
          {row.refs.map((ref) => <Sts1EntityToken key={`${ref.type}-${ref.id}`} type={ref.type} id={ref.id} refs={refs} />)}
        </div>
        {row.description ? <p className="mt-0.5 font-game-text text-xs text-gray-400">{row.description}</p> : null}
      </div>
      <span className="shrink-0 font-game-title text-base text-[#efc851] [text-shadow:0_2px_0_#000]">{row.points}</span>
    </li>
  );
}

export function Sts1ScoreBonusList({
  rows,
  refs,
  scoreLabels,
  labels,
  serviceLocale,
}: {
  rows: Sts1ScoreBonusRow[];
  refs: Sts1EntityRefs;
  scoreLabels: ScoreLabels;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return rows.filter((row) => !row.total && (!query || fuzzyMatchCodexText(`${row.name} ${row.description} ${row.id}`, query)));
  }, [rows, searchQuery]);
  const used = filtered.filter((row) => !row.unused);
  const unused = filtered.filter((row) => row.unused);
  return (
    <Sts1ListLayout
      title={labels.listTitles["score-bonuses"]}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
    >
      <div className="mx-auto max-w-2xl">
        <section className="rounded-lg border border-white/10 bg-black/50 px-5 py-3">
          <ul>{used.map((row) => <ScoreLine key={row.slug} row={row} labels={scoreLabels} refs={refs} />)}</ul>
        </section>
        {unused.length ? (
          <section className="mt-6">
            <h2 className="mb-2 font-game-title text-sm font-bold text-gray-400">{scoreLabels.unused}</h2>
            <ul className="rounded-lg border border-white/10 bg-black/30 px-5 py-2 opacity-70">
              {unused.map((row) => <ScoreLine key={row.slug} row={row} labels={scoreLabels} refs={refs} />)}
            </ul>
          </section>
        ) : null}
        <div className="mt-8">
          <Sts1CommentsRail resourceType="score-bonus" slug="list" serviceLocale={serviceLocale} />
        </div>
      </div>
    </Sts1ListLayout>
  );
}

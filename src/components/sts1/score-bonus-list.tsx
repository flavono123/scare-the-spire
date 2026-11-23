"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1ScoreBonusRow } from "@/lib/sts1/compendium-extras";
import { sts1DetailPath, sts1IndexPath } from "@/lib/sts1/paths";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import type { Sts1EntityRefs, Sts1Keyword, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1HeroTip, Sts1MetaPill } from "./detail-chrome";
import { Sts1EventText } from "./event-text";
import { Sts1DetailModal, Sts1ListLayout, openOnPlainClick, useSts1Selection } from "./list-shell";
import { Sts1RelatedRail } from "./related-rail";
import { Sts1ScoreCalculator } from "./score-calculator";

type ScoreLabels = { title: string; death: string; victory: string; unused: string };

/** GameOverScreen's stat line: name, then the points right-aligned in gold. */
function ScoreLine({ row, labels, refs, highlighted }: { row: Sts1ScoreBonusRow; labels: ScoreLabels; refs?: Sts1EntityRefs; highlighted?: boolean }) {
  return (
    <span
      className={`flex items-start gap-3 rounded-md px-2 py-2 transition-colors ${highlighted ? "bg-primary/15 ring-1 ring-primary/70" : ""}`}
      data-sts1-score={row.slug}
      data-highlighted={highlighted ? "" : undefined}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-game-title text-base text-[#fff6e2] [text-shadow:0_2px_0_#000]">{row.name}</span>
          {row.screens.length === 1 ? (
            <span className="rounded border border-[#7fff00]/40 px-1.5 py-px font-game-text text-[10px] text-[#7fff00]">
              {row.screens[0] === "victory" ? labels.victory : labels.death}
            </span>
          ) : null}
        </span>
        {row.description ? <Sts1EventText text={row.description} refs={refs} className="mt-0.5 block font-game-text text-xs text-gray-400" /> : null}
      </span>
      <span className="shrink-0 font-game-title text-base text-[#efc851] [text-shadow:0_2px_0_#000]">{row.points}</span>
    </span>
  );
}

export function Sts1ScoreBonusDetail({
  row,
  refs,
  related = [],
  keywords = [],
  scoreLabels,
  labels,
  serviceLocale,
  onClose,
}: {
  row: Sts1ScoreBonusRow;
  refs: Sts1EntityRefs;
  related?: readonly Sts1RelatedGroup[];
  keywords?: readonly Sts1Keyword[];
  scoreLabels: ScoreLabels;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("score-bonuses")}
      backLabel={labels.listTitles["score-bonuses"]}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={(
        <div className="flex w-full flex-col items-center gap-4">
          <div className="w-full max-w-[26rem] rounded-lg border border-white/10 bg-black/60 px-4 py-2">
            <ScoreLine row={{ ...row, description: "" }} labels={scoreLabels} />
          </div>
          {row.description ? (
            <Sts1HeroTip title={row.name} description={row.description} keywords={keywords} refs={refs} className="w-full max-w-[22rem]" />
          ) : null}
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {row.screens.map((screen) => (
            <Sts1MetaPill key={screen} value={screen === "victory" ? scoreLabels.victory : scoreLabels.death} />
          ))}
          {row.unused ? <Sts1MetaPill value={scoreLabels.unused} color="#9ca3af" /> : null}
          {row.points ? <Sts1MetaPill value={row.points} color="#efc851" /> : null}
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={row.name} nameEn={row.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="score-bonus" slug={row.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

/**
 * The score page: GameOverScreen.calcScore as a calculator beside the score table. On a wide
 * screen the table stays in view and lights the lines the field being edited feeds.
 */
export function Sts1ScoreBonusList({
  rows,
  refs,
  related,
  keywords,
  scoreLabels,
  labels,
  serviceLocale,
}: {
  rows: Sts1ScoreBonusRow[];
  refs: Sts1EntityRefs;
  related?: Record<string, Sts1RelatedGroup[]>;
  keywords?: readonly Sts1Keyword[];
  scoreLabels: ScoreLabels;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const lines = useMemo(() => rows.filter((row) => !row.total), [rows]);
  const { selected, open, close } = useSts1Selection(lines, "score");
  const [searchQuery, setSearchQuery] = useState("");
  const [focused, setFocused] = useState<string[] | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return lines.filter((row) => !query || fuzzyMatchCodexText(`${row.name} ${row.nameEn} ${row.description} ${row.id}`, query));
  }, [lines, searchQuery]);
  const used = filtered.filter((row) => !row.unused);
  const unused = filtered.filter((row) => row.unused);
  // Keep the lit line in view inside the table (it scrolls on its own beside the calculator).
  useEffect(() => {
    if (!focused?.length) return;
    tableRef.current?.querySelector("[data-highlighted]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);
  const lineLink = (row: Sts1ScoreBonusRow) => (
    <li key={row.slug} className="border-b border-white/5 last:border-b-0">
      <Link
        prefetch={false}
        href={localizeLink(sts1DetailPath("score-bonuses", row.slug))}
        onClick={(event) => openOnPlainClick(event, () => open(row))}
        className="block rounded-md transition-colors hover:bg-white/[0.04]"
      >
        <ScoreLine row={row} labels={scoreLabels} highlighted={focused?.includes(row.id)} />
      </Link>
    </li>
  );
  return (
    <Sts1ListLayout
      title={labels.listTitles["score-bonuses"]}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <Sts1ScoreBonusDetail
            row={selected}
            refs={refs}
            related={related?.[selected.slug]}
            keywords={keywords}
            scoreLabels={scoreLabels}
            labels={labels}
            serviceLocale={serviceLocale}
            onClose={close}
          />
        </Sts1DetailModal>
      ) : null}
    >
      <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Sts1ScoreCalculator rows={rows} scoreLabels={scoreLabels} serviceLocale={serviceLocale} onFocusLines={setFocused} />
        <div ref={tableRef} className="lg:sticky lg:top-0 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
          <section className="rounded-lg border border-white/10 bg-black/50 px-3 py-2">
            <ul>{used.map(lineLink)}</ul>
          </section>
          {unused.length ? (
            <section className="mt-6">
              <h2 className="mb-2 font-game-title text-sm font-bold text-gray-400">{scoreLabels.unused}</h2>
              <ul className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 opacity-70">{unused.map(lineLink)}</ul>
            </section>
          ) : null}
        </div>
      </div>
    </Sts1ListLayout>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { EntityPreview } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import { seededShuffle } from "@/lib/beta-art-quiz";
import { neowsletterClaimHref } from "@/lib/neowsletter-anchors";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import {
  readVexingPuzzleboxRecord,
  updateVexingPuzzleboxRecord,
  type ConnectionsProgress,
} from "@/lib/vexing-puzzlebox-storage";
import type { ConnectionsCategory, ConnectionsPuzzle } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const MISTAKE_LIMIT = 4;
const GROUP_SIZE = 4;
const LEVEL_CLASS = [
  "bg-amber-300 text-black",
  "bg-green-400 text-black",
  "bg-sky-400 text-black",
  "bg-violet-400 text-black",
];
const LEVEL_EMOJI = ["🟨", "🟩", "🟦", "🟪"];

function emptyProgress(): ConnectionsProgress {
  return { guesses: [], solvedLevels: [], mistakes: 0 };
}

function SolvedCategory({
  category,
  finished,
  serviceLocale,
  gameLocale,
}: {
  category: ConnectionsCategory;
  finished: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${LEVEL_CLASS[category.level]}`}>
      <p className="text-center text-sm font-bold">{category.title}</p>
      {finished && serviceLocale === "ko" && (
        <p className="text-center text-xs opacity-70">{category.titleEn}</p>
      )}
      {category.note && <p className="mt-1 text-center text-xs">{category.note}</p>}
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {category.members.map((member) => (
          <li key={member.key} className="flex min-w-0 items-center gap-2 rounded-md bg-black/70 p-1.5 text-white">
            {member.entity.imageUrl && (
              <Image
                src={member.entity.imageUrl}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded object-contain"
              />
            )}
            <span className="min-w-0 text-xs [word-break:keep-all]">
              <EntityPreview entity={member.entity} serviceLocale={serviceLocale} gameLocale={gameLocale}>
                {member.name}
              </EntityPreview>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConnectionsClient({
  puzzles,
  serviceLocale,
  gameLocale,
}: {
  puzzles: ConnectionsPuzzle[];
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const [puzzleNumber, setPuzzleNumber] = useState(puzzles[0].number);
  const puzzle = puzzles.find((item) => item.number === puzzleNumber) ?? puzzles[0];
  const [progress, setProgress] = useState<ConnectionsProgress>(emptyProgress);
  const [selected, setSelected] = useState<string[]>([]);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get("p"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the puzzle number lives in the URL of a static page
    if (puzzles.some((item) => item.number === requested)) setPuzzleNumber(requested);
  }, [puzzles]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after hydration
    setProgress(readVexingPuzzleboxRecord().connections[puzzle.number] ?? emptyProgress());
    setSelected([]);
    setCopied(false);
  }, [puzzle.number]);

  const levelByKey = useMemo(
    () => new Map(puzzle.categories.flatMap((category) => (
      category.members.map((member) => [member.key, category.level] as const)
    ))),
    [puzzle],
  );
  const tiles = useMemo(
    () => seededShuffle(
      puzzle.categories.flatMap((category) => category.members),
      puzzle.number * 1000 + shuffleSeed,
    ),
    [puzzle, shuffleSeed],
  );

  const solvedAll = progress.solvedLevels.length === puzzle.categories.length;
  const failed = progress.mistakes >= MISTAKE_LIMIT;
  const finished = solvedAll || failed;
  const visibleCategories = [
    ...progress.solvedLevels.flatMap((level) => (
      puzzle.categories.filter((category) => category.level === level)
    )),
    ...(finished
      ? puzzle.categories.filter((category) => !progress.solvedLevels.includes(category.level))
      : []),
  ];
  const remainingTiles = tiles.filter((tile) => (
    !progress.solvedLevels.includes(levelByKey.get(tile.key) ?? -1)
  ));

  const saveProgress = (next: ConnectionsProgress) => {
    setProgress(next);
    updateVexingPuzzleboxRecord((record) => {
      record.connections[puzzle.number] = next;
    });
  };

  const toggleTile = (key: string) => {
    setSelected((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return current.length < GROUP_SIZE ? [...current, key] : current;
    });
  };

  const submit = () => {
    const levels = selected.map((key) => levelByKey.get(key) ?? 0);
    const correct = levels.every((level) => level === levels[0]);
    saveProgress({
      guesses: [...progress.guesses, levels],
      solvedLevels: correct ? [...progress.solvedLevels, levels[0]] : progress.solvedLevels,
      mistakes: correct ? progress.mistakes : progress.mistakes + 1,
    });
    setSelected([]);
  };

  const copyResult = async () => {
    const grid = progress.guesses
      .map((levels) => levels.map((level) => LEVEL_EMOJI[level]).join(""))
      .join("\n");
    const url = `${window.location.origin}${window.location.pathname}?p=${puzzle.number}`;
    try {
      await navigator.clipboard.writeText(
        `${serviceMessages[serviceLocale].nav.vexingPuzzlebox} ${copy.resultTitle} #${puzzle.number} · ${copy.mistakeCount} ${progress.mistakes}\n${grid}\n${url}`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl" data-connections-puzzle={puzzle.number}>
      {puzzles.length > 1 && (
        <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          {copy.puzzleLabel}
          <select
            value={puzzle.number}
            onChange={(event) => setPuzzleNumber(Number(event.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          >
            {puzzles.map((item) => (
              <option key={item.number} value={item.number}>#{item.number}</option>
            ))}
          </select>
        </label>
      )}

      <div className="space-y-2">
        {visibleCategories.map((category) => (
          <SolvedCategory
            key={category.level}
            category={category}
            finished={finished}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        ))}
      </div>

      {!finished && (
        <>
          <div className={`grid grid-cols-4 gap-1.5 sm:gap-2 ${visibleCategories.length > 0 ? "mt-2" : ""}`}>
            {remainingTiles.map((tile) => {
              const isSelected = selected.includes(tile.key);
              return (
                <button
                  key={tile.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleTile(tile.key)}
                  className={`flex min-h-16 items-center justify-center rounded-lg border px-1 py-2 text-center text-xs font-semibold transition-colors [word-break:keep-all] sm:min-h-20 sm:text-sm ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/90 text-foreground hover:border-primary/60"
                  }`}
                >
                  {tile.name}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {copy.remainingMistakes}
            <span className="flex gap-1" aria-label={`${MISTAKE_LIMIT - progress.mistakes}`}>
              {Array.from({ length: MISTAKE_LIMIT }, (_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full ${
                    index < MISTAKE_LIMIT - progress.mistakes ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setShuffleSeed((seed) => seed + 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/60"
            >
              {copy.shuffle}
            </button>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/60 disabled:opacity-40"
            >
              {copy.deselect}
            </button>
            <button
              type="button"
              disabled={selected.length !== GROUP_SIZE}
              onClick={submit}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {copy.submit}
            </button>
          </div>
        </>
      )}

      {finished && (
        <div className="mt-4 text-center">
          <p className="font-semibold">{solvedAll ? copy.solvedAll : copy.failed}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={copyResult}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              {copied ? copy.copied : copy.copyResult}
            </button>
            <button
              type="button"
              onClick={() => saveProgress(emptyProgress())}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/60"
            >
              {copy.retry}
            </button>
          </div>
        </div>
      )}

      <footer className="mt-6 space-y-1 text-center text-xs text-muted-foreground">
        <p>{copy.attribution.replace("{issue}", String(puzzle.issueNumber))}</p>
        <p className="flex justify-center gap-3">
          <a
            href={localizeHrefWithGameLocale(neowsletterClaimHref(puzzle.issueId, puzzle.claimId), serviceLocale, gameLocale)}
            className="underline hover:text-foreground"
          >
            {copy.sourceIssue}
          </a>
          <a
            href={`https://custom-connections-game.vercel.app/${puzzle.slug}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            {copy.sourcePuzzle}
          </a>
        </p>
      </footer>
    </section>
  );
}

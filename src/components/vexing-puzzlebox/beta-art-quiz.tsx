"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import { CHARACTER_HAND_TARGET_ATTRIBUTE } from "@/components/vexing-puzzlebox/character-hand-pointer";
import { useMerchantSay } from "@/components/vexing-puzzlebox/merchant-feedback";
import { usePuzzleboxSound } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { useVakuu } from "@/components/vexing-puzzlebox/vakuu-chatter";
import { buildBetaArtQuizSets } from "@/lib/beta-art-quiz";
import { playInvalidShake } from "@/lib/merchant-feedback";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import {
  readVexingPuzzleboxRecord,
  updateVexingPuzzleboxRecord,
} from "@/lib/vexing-puzzlebox-storage";
import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const HIGH_SCORE_SHARE = 0.7;
const STREAK = 3;
/** A pick this soon after the art appears was not a long look. */
const SNAP_PICK_MS = 1200;

export function BetaArtQuiz({
  entries,
  gameCopy,
  serviceLocale,
  gameLocale,
}: {
  entries: BetaArtEntry[];
  gameCopy: VexingPuzzleboxGameCopy;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const sets = useMemo(() => buildBetaArtQuizSets(entries), [entries]);
  const [setIndex, setSetIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [savedSets, setSavedSets] = useState<Record<string, boolean[]>>({});
  const [copied, setCopied] = useState(false);
  const say = useMerchantSay();
  const vakuu = useVakuu();
  const playSound = usePuzzleboxSound();
  const boardRef = useRef<HTMLDivElement>(null);
  const questionShownAt = useRef(0);
  const lines = copy.vakuu;
  const setFinished = setIndex !== null && answers.length === sets[setIndex].length && picked === null;
  const finalScore = answers.filter(Boolean).length;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after hydration
    setSavedSets(readVexingPuzzleboxRecord().betaArtSets);
    const requested = Number(new URLSearchParams(window.location.search).get("set"));
    if (requested >= 1 && requested <= sets.length) setSetIndex(requested - 1);
  }, [sets.length]);

  // Vakuu sums up a finished set.
  useEffect(() => {
    if (!setFinished || setIndex === null) return;
    const high = finalScore / sets[setIndex].length >= HIGH_SCORE_SHARE;
    vakuu(
      { lines: high ? lines.quizHigh : lines.quizLow, tags: ["result"], probability: 1, force: true },
      boardRef.current,
      { corner: true },
    );
  }, [setFinished, setIndex, finalScore, sets, lines, vakuu]);

  const openSet = (index: number | null, at = 0) => {
    questionShownAt.current = at;
    setSetIndex(index);
    setAnswers([]);
    setPicked(null);
    setCopied(false);
    const url = new URL(window.location.href);
    if (index === null) url.searchParams.delete("set");
    else url.searchParams.set("set", String(index + 1));
    window.history.replaceState(window.history.state, "", url);
  };

  if (setIndex === null) {
    return (
      <ul className="mx-auto grid max-w-2xl grid-cols-4 gap-2 sm:grid-cols-7">
        {sets.map((set, index) => {
          const saved = savedSets[index + 1];
          return (
            <li key={index}>
              <button
                type="button"
                onClick={(event) => openSet(index, event.timeStamp)}
                className={`w-full rounded-lg border py-3 text-center text-sm font-semibold transition-colors hover:border-primary/60 ${
                  saved ? "border-primary/50 bg-primary/10" : "border-border bg-card/90"
                }`}
              >
                {index + 1}
                <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                  {saved ? `${saved.filter(Boolean).length}/${set.length}` : set.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const set = sets[setIndex];

  if (setFinished) {
    const score = finalScore;
    const resultLine = score / set.length >= HIGH_SCORE_SHARE
      ? gameCopy.betaArtHighScore
      : gameCopy.betaArtLowScore;
    const copyResult = async () => {
      const grid = answers.map((correct) => (correct ? "🟩" : "🟥")).join("");
      const url = `${window.location.origin}${window.location.pathname}?mode=quiz&set=${setIndex + 1}`;
      try {
        await navigator.clipboard.writeText(
          `${gameCopy.title} ${copy.quizResultTitle} ${copy.quizSet} ${setIndex + 1} · ${score}/${set.length}\n${grid}\n${url}`,
        );
        setCopied(true);
      } catch {
        setCopied(false);
      }
    };
    return (
      <div ref={boardRef} className="mx-auto max-w-xl text-center" data-beta-art-result>
        <p className="font-game-title text-4xl font-bold tabular-nums">{score}/{set.length}</p>
        {resultLine && <p className="mt-2 text-sm text-muted-foreground">{resultLine}</p>}
        <p className="mt-3 text-lg tracking-tight">
          {answers.map((correct) => (correct ? "🟩" : "🟥")).join("")}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={copyResult}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            {copied ? copy.copied : copy.copyResult}
          </button>
          <button
            type="button"
            onClick={() => openSet(null)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/60"
          >
            {copy.quizBack}
          </button>
        </div>
      </div>
    );
  }

  const questionIndex = picked === null ? answers.length : answers.length - 1;
  const question = set[questionIndex];

  const pick = (key: string, choice: HTMLElement, at: number) => {
    if (picked !== null) return;
    const correct = key === question.entry.key;
    const nextAnswers = [...answers, correct];
    const streak = nextAnswers.slice(-STREAK);
    const remark = (pool: readonly string[], probability: number) => vakuu(
      { lines: pool.filter(Boolean), tags: ["answer"], probability },
      boardRef.current,
      { corner: true },
    );
    playSound("uiClick");
    if (correct) {
      say("success", choice);
      playSound("gold");
    } else {
      say("forbidden", choice);
      playInvalidShake(choice);
    }
    if (streak.length === STREAK && streak.every((answer) => answer === correct)) {
      remark(correct ? lines.quizStreakRight : lines.quizStreakWrong, 0.9);
    } else if (questionShownAt.current > 0 && at - questionShownAt.current < SNAP_PICK_MS) {
      remark(lines.quizFast, 0.5);
    } else if (correct) {
      remark([gameCopy.vakuuApproval, ...lines.quizCorrect], 0.35);
    } else {
      remark(lines.quizWrong, 0.4);
    }
    setPicked(key);
    setAnswers(nextAnswers);
    if (nextAnswers.length === set.length) {
      const nextSaved = { ...savedSets, [setIndex + 1]: nextAnswers };
      setSavedSets(nextSaved);
      updateVexingPuzzleboxRecord((record) => {
        record.betaArtSets = nextSaved;
      });
    }
  };

  return (
    <div ref={boardRef} className="mx-auto max-w-2xl" data-beta-art-question={questionIndex + 1}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={() => openSet(null)} className="underline hover:text-foreground">
          {copy.quizBack}
        </button>
        <span className="tabular-nums">
          {copy.quizSet} {setIndex + 1} · {copy.quizQuestion} {questionIndex + 1}/{set.length}
        </span>
      </div>

      <div className={`grid gap-2 ${picked !== null && question.entry.officialUrl ? "grid-cols-2" : "grid-cols-1"}`}>
        <figure className="relative aspect-[25/19] overflow-hidden rounded-xl border border-border bg-black">
          <Image
            src={question.entry.betaUrl}
            alt={copy.quizPrompt}
            width={720}
            height={540}
            className="h-full w-full object-contain"
          />
          {picked !== null && (
            <figcaption className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              {copy.beta}
            </figcaption>
          )}
        </figure>
        {picked !== null && question.entry.officialUrl && (
          <figure className="relative aspect-[25/19] overflow-hidden rounded-xl border border-border bg-black">
            <Image
              src={question.entry.officialUrl}
              alt={question.entry.name}
              width={720}
              height={540}
              className="h-full w-full object-contain"
            />
            <figcaption className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              {copy.official}
            </figcaption>
          </figure>
        )}
      </div>

      <p className="mt-3 text-center text-sm font-semibold">
        {picked === null ? (
          copy.quizPrompt
        ) : (
          <a
            href={localizeHrefWithGameLocale(question.entry.href, serviceLocale, gameLocale)}
            className="underline"
          >
            {question.entry.name}
          </a>
        )}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {question.choices.map((choice) => {
          const correct = choice.key === question.entry.key;
          const stateClass = picked === null
            ? "border-border bg-card/90 hover:border-primary/60"
            : correct
              ? "border-green-500 bg-green-500/20"
              : choice.key === picked
                ? "border-red-500 bg-red-500/20"
                : "border-border bg-card/50 opacity-60";
          return (
            <button
              key={choice.key}
              type="button"
              disabled={picked !== null}
              {...{ [CHARACTER_HAND_TARGET_ATTRIBUTE]: "" }}
              onClick={(event) => pick(choice.key, event.currentTarget, event.timeStamp)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors [word-break:keep-all] ${stateClass}`}
            >
              {/* A wrong pick reads as a nerf: red, jittering. */}
              <span className={picked !== null && !correct && choice.key === picked ? "connections-wrong-jitter inline-block" : ""}>
                {choice.name}
              </span>
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={(event) => {
              questionShownAt.current = event.timeStamp;
              setPicked(null);
            }}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            {answers.length === set.length ? copy.quizResult : copy.quizNext}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EntityPreview } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import {
  CHARACTER_HAND_TARGET_ATTRIBUTE,
  profileTokenCharacter,
} from "@/components/vexing-puzzlebox/character-hand-pointer";
import { defaultItemDisplay, DisplayToggles, type ItemDisplay } from "@/components/vexing-puzzlebox/display-toggles";
import { useMerchantSay } from "@/components/vexing-puzzlebox/merchant-feedback";
import { usePuzzleboxSound } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { useVakuu } from "@/components/vexing-puzzlebox/vakuu-chatter";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import { useBetaArtEntity } from "@/lib/beta-art-entity";
import { BETA_ART_QUIZ_LIVES, buildBetaArtQuizSets } from "@/lib/beta-art-quiz";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { playInvalidShake } from "@/lib/merchant-feedback";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
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

function ChoiceLabel({ entry, display }: { entry: BetaArtEntry; display: ItemDisplay }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-1">
      {display.token && entry.officialUrl && (
        <Image
          src={entry.officialUrl}
          alt=""
          width={120}
          height={90}
          className="h-14 w-[4.5rem] rounded object-contain sm:h-16 sm:w-20"
        />
      )}
      {display.local && <span className="block">{entry.name}</span>}
      {display.original && (
        <span className={`block ${display.local ? "text-[0.75em] font-normal opacity-70" : ""}`}>{entry.nameEn}</span>
      )}
    </span>
  );
}

/** The answer's name, with the game hover tip once its Compendium data arrives. */
function AnswerName({
  entry,
  serviceLocale,
  gameLocale,
}: {
  entry: BetaArtEntry;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const entity = useBetaArtEntity(entry, gameLocale);
  if (!entity) {
    return (
      <a href={localizeHrefWithGameLocale(entry.href, serviceLocale, gameLocale)} className="underline">
        {entry.name}
      </a>
    );
  }
  return (
    <EntityPreview entity={entity} serviceLocale={serviceLocale} gameLocale={gameLocale}>
      {entry.name}
    </EntityPreview>
  );
}

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
  const [display, setDisplay] = useState<ItemDisplay>(() => defaultItemDisplay(gameLocale));
  const say = useMerchantSay();
  const vakuu = useVakuu();
  const playSound = usePuzzleboxSound();
  const { stored, profile } = useStoredProfileSnapshot();
  const energyIcon = resolveSts2EnergyIcon(profileTokenCharacter(stored, profile) ?? "colorless");
  const boardRef = useRef<HTMLDivElement>(null);
  const questionShownAt = useRef(0);
  const lines = copy.vakuu;
  const mistakes = answers.filter((answer) => !answer).length;
  const livesLeft = BETA_ART_QUIZ_LIVES - mistakes;
  const set = setIndex === null ? null : sets[setIndex];
  const outOfLives = livesLeft <= 0;
  const setFinished = set !== null && (answers.length === set.length || outOfLives) && picked === null;
  const finalScore = answers.filter(Boolean).length;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after hydration
    setSavedSets(readVexingPuzzleboxRecord().betaArtSets);
    const requested = Number(new URLSearchParams(window.location.search).get("set"));
    if (requested >= 1 && requested <= sets.length) setSetIndex(requested - 1);
  }, [sets.length]);

  // Vakuu sums up a finished set.
  useEffect(() => {
    if (!setFinished || !set) return;
    const high = !outOfLives && finalScore / set.length >= HIGH_SCORE_SHARE;
    vakuu(
      { lines: high ? lines.quizHigh : lines.quizLow, tags: ["result"], probability: 1, force: true },
      boardRef.current,
      { corner: true },
    );
  }, [setFinished, set, outOfLives, finalScore, lines, vakuu]);

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

  if (set === null || setIndex === null) {
    return (
      <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-beta-art-sets={sets.length}>
        {sets.map((questions, index) => {
          const saved = savedSets[index + 1];
          return (
            <li key={index}>
              <button
                type="button"
                onClick={(event) => openSet(index, event.timeStamp)}
                className={`w-full rounded-lg border p-2 text-left transition-colors hover:border-primary/60 ${
                  saved ? "border-primary/50 bg-primary/10" : "border-border bg-card/90"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-game-title text-sm font-semibold">
                    {copy.quizSet} {index + 1}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {saved ? `${saved.filter(Boolean).length}/${questions.length}` : questions.length}
                  </span>
                </span>
                <span className="mt-1.5 grid grid-cols-4 gap-1">
                  {questions.map((question) => (
                    <Image
                      key={question.entry.key}
                      src={question.entry.betaUrl}
                      alt=""
                      width={96}
                      height={72}
                      loading="lazy"
                      className="aspect-[25/19] w-full rounded-sm bg-black/50 object-cover"
                    />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  if (setFinished) {
    const resultLine = !outOfLives && finalScore / set.length >= HIGH_SCORE_SHARE
      ? gameCopy.betaArtHighScore
      : gameCopy.betaArtLowScore;
    const grid = answers.map((correct) => (correct ? "🟩" : "🟥")).join("");
    const copyResult = async () => {
      const url = `${window.location.origin}${window.location.pathname}?mode=quiz&set=${setIndex + 1}`;
      try {
        await navigator.clipboard.writeText(
          `${gameCopy.title} ${copy.quizResultTitle} ${copy.quizSet} ${setIndex + 1} · ${finalScore}/${set.length}\n${grid}\n${url}`,
        );
        setCopied(true);
      } catch {
        setCopied(false);
      }
    };
    return (
      <div ref={boardRef} className="mx-auto max-w-xl text-center" data-beta-art-result={outOfLives ? "failed" : "cleared"}>
        <p className="font-semibold">{outOfLives ? copy.failed : copy.quizCleared}</p>
        <p className="mt-1 font-game-title text-4xl font-bold tabular-nums">{finalScore}/{set.length}</p>
        {resultLine && <p className="mt-2 text-sm text-muted-foreground">{resultLine}</p>}
        <p className="mt-3 text-lg tracking-tight">{grid}</p>
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
            onClick={(event) => openSet(setIndex, event.timeStamp)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/60"
          >
            {copy.retry}
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
    const nextMistakes = nextAnswers.filter((answer) => !answer).length;
    if (nextAnswers.length === set.length || nextMistakes >= BETA_ART_QUIZ_LIVES) {
      const nextSaved = { ...savedSets, [setIndex + 1]: nextAnswers };
      setSavedSets(nextSaved);
      updateVexingPuzzleboxRecord((record) => {
        record.betaArtSets = nextSaved;
      });
    }
  };

  const lastQuestion = answers.length === set.length || livesLeft <= 0;

  return (
    <div ref={boardRef} className="mx-auto max-w-2xl" data-beta-art-question={questionIndex + 1}>
      <div className="mb-3 flex justify-center">
        <DisplayToggles
          display={display}
          gameLocale={gameLocale}
          labels={{ group: copy.viewsLabel, token: copy.viewTokens, local: copy.viewLocal, original: copy.viewOriginal }}
          onChange={(next) => setDisplay(next)}
        />
      </div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={() => openSet(null)} className="underline hover:text-foreground">
          {copy.quizBack}
        </button>
        <span className="flex items-center gap-3">
          <span className="tabular-nums">
            {copy.quizSet} {setIndex + 1} · {copy.quizQuestion} {questionIndex + 1}/{set.length}
          </span>
          <span className="flex gap-0.5" role="img" aria-label={`${livesLeft}/${BETA_ART_QUIZ_LIVES}`} data-beta-art-lives={livesLeft}>
            {Array.from({ length: BETA_ART_QUIZ_LIVES }, (_, index) => (
              <Image
                key={index}
                src={energyIcon}
                alt=""
                width={74}
                height={69}
                className={`h-5 w-5 object-contain transition-[filter,opacity] duration-300 ${
                  index < livesLeft ? "" : "opacity-35 grayscale"
                }`}
              />
            ))}
          </span>
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
            <figcaption className="absolute left-2 top-1.5 text-[10px] tracking-wide text-white/35">{copy.beta}</figcaption>
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
          </figure>
        )}
      </div>

      <p className="mt-3 text-center text-sm font-semibold">
        {picked === null ? (
          copy.quizPrompt
        ) : (
          <AnswerName entry={question.entry} serviceLocale={serviceLocale} gameLocale={gameLocale} />
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
              className={`flex justify-center rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors [word-break:keep-all] ${stateClass}`}
            >
              {/* A wrong pick reads as a nerf: red, jittering. */}
              <span className={picked !== null && !correct && choice.key === picked ? "connections-wrong-jitter inline-block" : ""}>
                <ChoiceLabel entry={choice} display={display} />
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
            {lastQuestion ? copy.quizResult : copy.quizNext}
          </button>
        </div>
      )}
    </div>
  );
}

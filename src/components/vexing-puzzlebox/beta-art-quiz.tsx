"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntityPreview } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import {
  CHARACTER_HAND_TARGET_ATTRIBUTE,
  profileTokenCharacter,
} from "@/components/vexing-puzzlebox/character-hand-pointer";
import {
  defaultItemDisplay,
  DisplayToggles,
  hasLocalNames,
  type ItemDisplay,
} from "@/components/vexing-puzzlebox/display-toggles";
import { useMerchantSay } from "@/components/vexing-puzzlebox/merchant-feedback";
import { usePuzzleboxSound } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { ScoreSummary, type ScoreSubmission } from "@/components/vexing-puzzlebox/score-summary";
import { useVakuu } from "@/components/vexing-puzzlebox/vakuu-chatter";
import { useAuth } from "@/hooks/use-auth";
import { puzzleboxPlayer, submitPuzzleboxRun, useMyPuzzleboxStandings } from "@/hooks/use-puzzlebox-scores";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import { useBetaArtEntity } from "@/lib/beta-art-entity";
import { BETA_ART_QUIZ_LIVES, buildBetaArtQuizSets } from "@/lib/beta-art-quiz";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { playInvalidShake } from "@/lib/merchant-feedback";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
import {
  betaQuizMaxScore,
  mergeDisplay,
  scoreBetaQuiz,
  type BetaQuizAnswer,
  type RunDisplay,
} from "@/lib/vexing-puzzlebox-score";
import {
  readLocalBestScores,
  readVexingPuzzleboxRecord,
  recordLocalScore,
  updateVexingPuzzleboxRecord,
  type LocalBestScore,
} from "@/lib/vexing-puzzlebox-storage";
import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const HIGH_SCORE_SHARE = 0.7;
const STREAK = 3;
/** A pick this soon after the art appears was not a long look. */
const SNAP_PICK_MS = 1200;
function runDisplayOf(display: ItemDisplay, gameLocale: GameLocale): RunDisplay {
  return { token: display.token, local: hasLocalNames(gameLocale) && display.local, original: display.original };
}

/**
 * Time on the clock for the current question: from the art showing until the pick,
 * stopped while the page is hidden.
 */
function useQuestionClock() {
  const clock = useRef({ start: 0, hiddenAt: 0, hidden: 0 });
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const onVisibility = () => {
      const now = performance.now();
      const current = clock.current;
      if (document.hidden) {
        current.hiddenAt = now;
      } else if (current.hiddenAt) {
        current.hidden += now - current.hiddenAt;
        current.hiddenAt = 0;
      }
      setPaused(document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const start = useCallback(() => {
    clock.current = { start: performance.now(), hiddenAt: document.hidden ? performance.now() : 0, hidden: 0 };
  }, []);
  const elapsed = useCallback(() => {
    const now = performance.now();
    const current = clock.current;
    if (!current.start) return 0;
    return Math.round(now - current.start - current.hidden - (current.hiddenAt ? now - current.hiddenAt : 0));
  }, []);
  const started = useCallback(() => clock.current.start > 0, []);
  const reset = useCallback(() => {
    clock.current = { start: 0, hiddenAt: 0, hidden: 0 };
  }, []);
  return useMemo(() => ({ start, elapsed, started, reset, paused }), [start, elapsed, started, reset, paused]);
}

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
  const [answers, setAnswers] = useState<BetaQuizAnswer[]>([]);
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
  /** What the open question has had on screen; the next question starts from the toggles. */
  const [questionShown, setQuestionShown] = useState<RunDisplay | undefined>(undefined);
  const artRef = useRef<HTMLImageElement>(null);
  const [clockOn, setClockOn] = useState(false);
  const [hurt, setHurt] = useState(0);
  const [localScores, setLocalScores] = useState<Record<string, LocalBestScore>>({});
  const [submission, setSubmission] = useState<ScoreSubmission | null>(null);
  const [standingsRefresh, setStandingsRefresh] = useState(0);
  const { ensureUser } = useAuth();
  const clock = useQuestionClock();
  const lines = copy.vakuu;
  const results = answers.map((answer) => answer.correct);
  const mistakes = results.filter((answer) => !answer).length;
  const livesLeft = BETA_ART_QUIZ_LIVES - mistakes;
  const set = setIndex === null ? null : sets[setIndex];
  const outOfLives = livesLeft <= 0;
  const setFinished = set !== null && (answers.length === set.length || outOfLives) && picked === null;
  const finalScore = results.filter(Boolean).length;
  const scoreBoards = useMemo(
    () => Object.fromEntries(sets.map((questions, index) => [String(index + 1), betaQuizMaxScore(questions.length)])),
    [sets],
  );
  const standings = useMyPuzzleboxStandings("beta-quiz", scoreBoards, standingsRefresh);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after hydration
    setSavedSets(readVexingPuzzleboxRecord().betaArtSets);
    setLocalScores(readLocalBestScores("beta-quiz"));
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
    setQuestionShown(undefined);
    clock.reset();
    setClockOn(false);
    setSetIndex(index);
    setAnswers([]);
    setPicked(null);
    setCopied(false);
    setSubmission(null);
    const url = new URL(window.location.href);
    if (index === null) url.searchParams.delete("set");
    else url.searchParams.set("set", String(index + 1));
    window.history.replaceState(window.history.state, "", url);
  };

  // The clock starts once the art has loaded; a cached one is ready at once.
  const currentQuestionKey = set && picked === null && !setFinished ? set[answers.length]?.entry.key : null;
  useEffect(() => {
    if (!currentQuestionKey) return;
    if (artRef.current?.complete && artRef.current.naturalWidth > 0 && !clock.started()) {
      clock.start();
      setClockOn(true);
    }
  }, [currentQuestionKey, clock]);

  const finishSet = (final: BetaQuizAnswer[], index: number, questions: number) => {
    const run = { questions, answers: final };
    const result = scoreBetaQuiz(run);
    setLocalScores(recordLocalScore("beta-quiz", index + 1, result.total, result.perfect));
    const board = index + 1;
    setSubmission({ board, pending: true, result: null });
    void submitPuzzleboxRun({
      ensureUser,
      game: "beta-quiz",
      board,
      run,
      player: puzzleboxPlayer(serviceMessages[serviceLocale].comments.defaultNickname),
    }).then((response) => {
      setSubmission((current) => (current?.board === board ? { board, pending: false, result: response } : current));
      if (response) setStandingsRefresh((count) => count + 1);
    });
  };

  if (set === null || setIndex === null) {
    return (
      <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-beta-art-sets={sets.length}>
        {sets.map((questions, index) => {
          const saved = savedSets[index + 1];
          const best = localScores[index + 1];
          const standing = standings[index + 1];
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
                {best && (
                  <span className="mt-1.5 flex items-baseline justify-end gap-1.5 whitespace-nowrap">
                    <span className="font-game-title text-sm font-bold tabular-nums spire-gold">{best.best}</span>
                    {standing && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {copy.rankLine.replace("{rank}", String(standing.rank)).replace("{players}", String(standing.players))}
                      </span>
                    )}
                  </span>
                )}
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
    const breakdown = scoreBetaQuiz({ questions: set.length, answers });
    const grid = results.map((correct) => (correct ? "🟩" : "🟥")).join("");
    const copyResult = async () => {
      const url = `${window.location.origin}${window.location.pathname}?mode=quiz&set=${setIndex + 1}`;
      try {
        await navigator.clipboard.writeText(
          `${gameCopy.title} ${copy.quizResultTitle} ${copy.quizSet} ${setIndex + 1} · ${finalScore}/${set.length} · ${breakdown.total}${copy.scoreUnit}\n${grid}\n${url}`,
        );
        setCopied(true);
      } catch {
        setCopied(false);
      }
    };
    return (
      <div ref={boardRef} className="mx-auto max-w-xl text-center" data-beta-art-result={outOfLives ? "failed" : "cleared"}>
        <p className="font-semibold">{outOfLives ? copy.failed : copy.quizCleared}</p>
        <p className="mt-1 font-game-title text-2xl font-bold tabular-nums text-muted-foreground">{finalScore}/{set.length}</p>
        {resultLine && <p className="mt-2 text-sm text-muted-foreground">{resultLine}</p>}
        <p className="mt-3 text-lg tracking-tight">{grid}</p>
        <ScoreSummary
          breakdown={breakdown}
          best={localScores[setIndex + 1]}
          submission={submission?.board === setIndex + 1 ? submission : null}
          rankingsQuery={`game=beta-quiz&board=${setIndex + 1}`}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
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
  const pickedAnswer = picked === null ? null : answers[answers.length - 1];

  const changeDisplay = (next: ItemDisplay) => {
    setDisplay(next);
    if (picked === null) {
      setQuestionShown(mergeDisplay(mergeDisplay(questionShown, runDisplayOf(display, gameLocale)), runDisplayOf(next, gameLocale)));
    }
  };

  const pick = (key: string, choice: HTMLElement, at: number) => {
    if (picked !== null) return;
    const correct = key === question.entry.key;
    const answer: BetaQuizAnswer = {
      pick: question.choices.findIndex((item) => item.key === key),
      correct,
      // Picked before the art finished loading: no time on the clock, so no speed bonus.
      ms: clock.started() ? clock.elapsed() : 600000,
      shown: mergeDisplay(questionShown, runDisplayOf(display, gameLocale)),
    };
    clock.reset();
    setClockOn(false);
    const nextAnswers = [...answers, answer];
    const nextResults = nextAnswers.map((item) => item.correct);
    const streak = nextResults.slice(-STREAK);
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
      playSound("lifeLost");
      setHurt((count) => count + 1);
    }
    if (streak.length === STREAK && streak.every((item) => item === correct)) {
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
    const nextMistakes = nextResults.filter((item) => !item).length;
    if (nextAnswers.length === set.length || nextMistakes >= BETA_ART_QUIZ_LIVES) {
      const nextSaved = { ...savedSets, [setIndex + 1]: nextResults };
      setSavedSets(nextSaved);
      updateVexingPuzzleboxRecord((record) => {
        record.betaArtSets = nextSaved;
      });
      finishSet(nextAnswers, setIndex, set.length);
    }
  };

  const lastQuestion = answers.length === set.length || livesLeft <= 0;
  const lostLife = picked !== null && pickedAnswer !== null && !pickedAnswer.correct;

  return (
    <div ref={boardRef} className="relative mx-auto max-w-2xl" data-beta-art-question={questionIndex + 1}>
      {lostLife && (
        <div key={`hurt-${hurt}`} className="beta-quiz-hurt pointer-events-none absolute -inset-2 z-10 rounded-xl" aria-hidden="true" />
      )}
      <div className="mb-3 flex items-center justify-center gap-3">
        <DisplayToggles
          display={display}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          labels={{ group: copy.viewsLabel, token: copy.viewTokens }}
          onChange={(next) => changeDisplay(next)}
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
          <span
            className={`relative flex gap-1 ${lostLife ? "connections-invalid-shake" : ""}`}
            role="img"
            aria-label={`${livesLeft}/${BETA_ART_QUIZ_LIVES}`}
            data-beta-art-lives={livesLeft}
          >
            {Array.from({ length: BETA_ART_QUIZ_LIVES }, (_, index) => {
              const justLost = lostLife && index === livesLeft;
              return (
                <Image
                  key={justLost ? `lost-${hurt}` : index}
                  src={energyIcon}
                  alt=""
                  width={74}
                  height={69}
                  className={`h-7 w-7 object-contain ${
                    justLost ? "beta-quiz-life-lost" : index < livesLeft ? "" : "opacity-35 brightness-50 grayscale"
                  }`}
                />
              );
            })}
            {lostLife && (
              <span
                key={`float-${hurt}`}
                className="beta-quiz-life-float pointer-events-none absolute -top-4 whitespace-nowrap font-game-title text-sm font-bold text-red-400 drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]"
                style={{ left: `${((livesLeft + 0.5) / BETA_ART_QUIZ_LIVES) * 100}%` }}
                aria-hidden="true"
              >
                {copy.livesLost}
              </span>
            )}
          </span>
        </span>
      </div>

      {/* Question and answer keep one layout, so the choices never move between them. */}
      <div className="grid grid-cols-2 gap-2">
        <figure className="relative aspect-[25/19] overflow-hidden rounded-xl border border-border bg-black">
          <Image
            ref={artRef}
            src={question.entry.betaUrl}
            alt={copy.quizPrompt}
            width={720}
            height={540}
            onLoad={() => {
              if (picked === null && !clock.started()) {
                clock.start();
                setClockOn(true);
              }
            }}
            className="h-full w-full object-contain"
          />
          <figcaption className="absolute left-2 top-1.5 text-[10px] tracking-wide text-white/35">{copy.beta}</figcaption>
        </figure>
        <figure className="relative flex aspect-[25/19] items-center justify-center overflow-hidden rounded-xl border border-border bg-black">
          {picked !== null && question.entry.officialUrl ? (
            <Image
              src={question.entry.officialUrl}
              alt={question.entry.name}
              width={720}
              height={540}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="font-game-title text-4xl font-bold text-white/15" aria-hidden="true">
              {picked !== null ? "" : "?"}
            </span>
          )}
          {picked !== null && !question.entry.officialUrl && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-white/50">{copy.betaOnly}</span>
          )}
        </figure>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        {clockOn && picked === null && (
          <div
            key={question.entry.key}
            className="beta-quiz-clock h-full bg-green-400/80"
            style={{ animationPlayState: clock.paused ? "paused" : "running" }}
          />
        )}
      </div>

      <p className="mt-2 text-center text-sm font-semibold">
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

      {/* The next button's row is held while a question is open, so the page keeps its height. */}
      <div className={`mt-4 text-center ${picked === null ? "invisible" : ""}`} aria-hidden={picked === null ? true : undefined}>
        <button
          type="button"
          tabIndex={picked === null ? -1 : undefined}
          onClick={(event) => {
            questionShownAt.current = event.timeStamp;
            setQuestionShown(undefined);
            setPicked(null);
            const board = boardRef.current;
            if (board && board.getBoundingClientRect().top < 0) board.scrollIntoView({ block: "start", behavior: "smooth" });
          }}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
        >
          {lastQuestion ? copy.quizResult : copy.quizNext}
        </button>
      </div>
    </div>
  );
}

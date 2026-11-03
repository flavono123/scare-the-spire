"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { RichText } from "@/components/rich-text";
import Image from "@/components/ui/static-image";
import {
  CHARACTER_HAND_TARGET_ATTRIBUTE,
  profileTokenCharacter,
} from "@/components/vexing-puzzlebox/character-hand-pointer";
import { EndTurnButton, PileButton } from "@/components/vexing-puzzlebox/combat-buttons";
import {
  defaultItemDisplay,
  DisplayToggles,
  hasLocalNames,
  type ItemDisplay,
} from "@/components/vexing-puzzlebox/display-toggles";
import { useMerchantSay } from "@/components/vexing-puzzlebox/merchant-feedback";
import { PotionBelt, type BeltPotion } from "@/components/vexing-puzzlebox/potion-belt";
import { usePuzzleboxSound } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { playRockHit, playRockThrow } from "@/components/vexing-puzzlebox/rock-throw";
import {
  playShuffleHands,
  SHUFFLE_GRIP_MS,
  SHUFFLE_RELEASE_MS,
  SHUFFLE_TOTAL_MS,
  shuffleHandUrls,
  type ShuffleMove,
} from "@/components/vexing-puzzlebox/shuffle-hands";
import { useVakuu } from "@/components/vexing-puzzlebox/vakuu-chatter";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import { seededShuffle } from "@/lib/beta-art-quiz";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { playPurchaseFailedWiggle } from "@/lib/merchant-feedback";
import { neowsletterClaimHref } from "@/lib/neowsletter-anchors";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
import { MEGA_CRIT_TOKEN_SRC, NEOWSLETTER_TOKEN_SRC } from "@/lib/vexing-puzzlebox";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import {
  readVexingPuzzleboxRecord,
  updateVexingPuzzleboxRecord,
  type ConnectionsProgress,
} from "@/lib/vexing-puzzlebox-storage";
import type { ConnectionsCategory, ConnectionsMember, ConnectionsPuzzle } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const MISTAKE_LIMIT = 4;
const GROUP_SIZE = 4;
const PURPLE_LEVEL = 3;
const LEVEL_CLASS = [
  "bg-amber-300 text-black",
  "bg-green-400 text-black",
  "bg-sky-400 text-black",
  "bg-violet-400 text-black",
];
const LEVEL_EMOJI = ["🟨", "🟩", "🟦", "🟪"];
/** custom-connections-game shakes a wrong guess and takes the mistake 1 s later. */
const WRONG_FEEDBACK_MS = 1000;
/** A freshly solved group's title waves this long. */
const FRESH_TITLE_MS = 2500;
/** Vakuu waits for the merchant to finish his line. */
const VAKUU_DELAY_MS = 700;
/** Vakuu's IdleDetector waits 20 s and then rolls 2% a second; a web page gets bored a bit sooner. */
const IDLE_MS = 25_000;
const IDLE_CHANCE_PER_TICK = 0.08;
const FAST_SUBMIT_MS = 3500;
const SHUFFLE_SPAM_COUNT = 3;
const SHUFFLE_SPAM_WINDOW_MS = 12_000;
const FLIP_FLOP_COUNT = 2;
const INSPECT_PEEK_COUNT = 5;
/** Player.initialMaxPotionSlotCount */
const POTION_SLOT_COUNT = 3;

type Toast = { text: string; negative: boolean };

function MemberLabels({ member, display }: { member: ConnectionsMember; display: ItemDisplay }) {
  return (
    <>
      {display.local && <span className="block">{member.name}</span>}
      {display.original && (
        <span className={`block ${display.local ? "text-[0.7em] font-normal opacity-70" : ""}`}>
          {member.raw}
        </span>
      )}
    </>
  );
}

function emptyProgress(): ConnectionsProgress {
  return { guesses: [], guessKeys: [], solvedLevels: [], mistakes: 0 };
}

function guessId(keys: string[]): string {
  return [...keys].sort().join("|");
}

function fullBelt(): boolean[] {
  return Array.from({ length: POTION_SLOT_COUNT }, () => true);
}

function randomItem<T>(items: T[]): T | null {
  return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
}

/**
 * The tile a thrown rock lands on. With one to three tiles picked, it is an unpicked tile
 * of the group most of them belong to (ties go to the group picked first); otherwise any tile left.
 */
function rockTarget(selected: string[], remaining: string[], levelByKey: Map<string, number>): string | null {
  if (selected.length > 0 && selected.length < GROUP_SIZE) {
    const counts = new Map<number, number>();
    for (const key of selected) {
      const level = levelByKey.get(key) ?? -1;
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    const most = Math.max(...counts.values());
    const level = selected.map((key) => levelByKey.get(key) ?? -1).find((item) => counts.get(item) === most);
    const pick = randomItem(remaining.filter((key) => levelByKey.get(key) === level && !selected.includes(key)));
    if (pick) return pick;
  }
  return randomItem(remaining);
}

function SolvedCategory({
  category,
  display,
  fresh,
  serviceLocale,
  gameLocale,
}: {
  category: ConnectionsCategory;
  display: ItemDisplay;
  /** Just solved: the title waves like a buff. */
  fresh: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const title = display.local || !display.original ? category.title : category.titleEn;
  return (
    <div className={`rounded-lg px-3 py-2.5 ${LEVEL_CLASS[category.level]}`} data-connections-solved={category.level}>
      <p className="text-center text-sm font-bold">
        {fresh ? <RichText text={`[sine]${title}[/sine]`} /> : title}
      </p>
      {display.local && display.original && category.title !== category.titleEn && (
        <p className="text-center text-xs opacity-70">{category.titleEn}</p>
      )}
      {display.local && category.note && (
        <p className="mt-1 text-center text-xs">{category.note}</p>
      )}
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {category.members.map((member) => (
          <li key={member.key} className="flex min-w-0 items-center gap-2 rounded-md bg-black/70 p-1.5 text-white">
            {display.token && member.entity.imageUrl && (
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
                {display.local || display.original ? (
                  <MemberLabels member={member} display={display} />
                ) : (
                  member.name
                )}
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
  gameCopy,
  beltPotion,
  serviceLocale,
  gameLocale,
}: {
  puzzles: ConnectionsPuzzle[];
  gameCopy: VexingPuzzleboxGameCopy;
  beltPotion: BeltPotion;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const lines = copy.vakuu;
  const [puzzleNumber, setPuzzleNumber] = useState(puzzles[0].number);
  const puzzle = puzzles.find((item) => item.number === puzzleNumber) ?? puzzles[0];
  const [progress, setProgress] = useState<ConnectionsProgress>(emptyProgress);
  const [selected, setSelected] = useState<string[]>([]);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [wrongKeys, setWrongKeys] = useState<string[] | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [freshLevel, setFreshLevel] = useState<number | null>(null);
  const [hintKey, setHintKey] = useState<string | null>(null);
  /** The draw pile counts its cards back in while the hands shuffle. */
  const [shuffleCount, setShuffleCount] = useState<number | null>(null);
  const say = useMerchantSay();
  const vakuu = useVakuu();
  const playSound = usePuzzleboxSound();
  const { stored, profile } = useStoredProfileSnapshot();
  // Mistakes are spent like energy: the profile character's, or colorless without one.
  const energyIcon = resolveSts2EnergyIcon(profileTokenCharacter(stored, profile) ?? "colorless");
  const localNamesDiffer = hasLocalNames(gameLocale);
  const [display, setDisplay] = useState<ItemDisplay>(() => defaultItemDisplay(gameLocale));

  const boardRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingShuffle = useRef<Map<string, DOMRect> | null>(null);
  const timers = useRef<number[]>([]);
  const lastActivityAt = useRef(0);
  const firstPickAt = useRef<number | null>(null);
  const shuffleTimes = useRef<number[]>([]);
  const deselectCounts = useRef(new Map<string, number>());
  const inspectCount = useRef(0);

  const later = (callback: () => void, ms: number) => {
    timers.current.push(window.setTimeout(callback, ms));
  };

  /** Vakuu comments from a top corner of the board. */
  const remark = (
    pool: readonly string[],
    tags: string[],
    probability: number,
    options: { force?: boolean; vars?: Record<string, number>; delay?: number } = {},
  ) => {
    const speak = () => vakuu(
      { lines: pool.filter(Boolean), tags, probability, force: options.force, vars: options.vars },
      boardRef.current,
      { corner: true },
    );
    if (options.delay) later(speak, options.delay);
    else speak();
  };

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
    setWrongKeys(null);
    setToast(null);
    setHintKey(null);
  }, [puzzle.number]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The shuffle hands should not pop in half loaded.
    for (const url of shuffleHandUrls()) {
      const image = new window.Image();
      image.src = url;
    }
  }, []);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

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

  // Vakuu's IdleDetector: a long silence earns a remark now and then.
  useEffect(() => {
    if (finished) return;
    // Zero means the clock starts on the first tick.
    lastActivityAt.current = 0;
    const markActive = (event: Event) => {
      lastActivityAt.current = event.timeStamp;
    };
    window.addEventListener("pointerdown", markActive);
    window.addEventListener("keydown", markActive);
    const tick = window.setInterval(() => {
      const now = performance.now();
      if (lastActivityAt.current === 0) lastActivityAt.current = now;
      if (document.hidden || now - lastActivityAt.current < IDLE_MS) return;
      if (Math.random() >= IDLE_CHANCE_PER_TICK) return;
      lastActivityAt.current = now;
      vakuu({ lines: lines.idle, tags: ["idle"], probability: 1 }, boardRef.current, { corner: true });
    }, 1000);
    return () => {
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
      window.clearInterval(tick);
    };
  }, [finished, lines.idle, vakuu]);

  // Tiles already sit in their shuffled slots here; the hands carry them over from where they were.
  useLayoutEffect(() => {
    const before = pendingShuffle.current;
    if (!before) return;
    pendingShuffle.current = null;
    const moves: ShuffleMove[] = [];
    for (const [key, from] of before) {
      const element = tileRefs.current.get(key);
      if (!element) continue;
      const to = element.getBoundingClientRect();
      if (Math.abs(to.left - from.left) < 1 && Math.abs(to.top - from.top) < 1) continue;
      moves.push({ element, from, to });
    }
    playShuffleHands(moves);
    if (moves.length === 0) return;
    for (const offset of [0, 70, 150]) later(() => playSound("cardSlide"), SHUFFLE_GRIP_MS + offset);
    later(() => playSound("cardStack"), SHUFFLE_RELEASE_MS);
    const total = before.size;
    for (let count = 1; count <= total; count += 1) {
      later(() => setShuffleCount(count), ((count - 1) / total) * SHUFFLE_TOTAL_MS);
    }
    later(() => setShuffleCount(null), SHUFFLE_TOTAL_MS + 80);
  }, [tiles, playSound]);

  const saveProgress = (next: ConnectionsProgress) => {
    setProgress(next);
    updateVexingPuzzleboxRecord((record) => {
      record.connections[puzzle.number] = next;
    });
  };

  const showToast = (next: Toast) => {
    setToast(next);
    later(() => setToast((current) => (current === next ? null : current)), WRONG_FEEDBACK_MS);
  };

  const toggleTile = (key: string, tile: HTMLElement, at: number) => {
    if (selected.includes(key)) {
      setSelected(selected.filter((item) => item !== key));
      playSound("uiClick");
      const count = (deselectCounts.current.get(key) ?? 0) + 1;
      deselectCounts.current.set(key, count);
      if (count === FLIP_FLOP_COUNT) remark(lines.flipFlop, ["hesitation"], 0.8);
      return;
    }
    if (selected.length >= GROUP_SIZE) {
      // A fifth pick is a purchase with full hands: NMerchantSlot's wiggle and the no-room line.
      playPurchaseFailedWiggle(tile);
      say("space", tile);
      return;
    }
    if (selected.length === 0) firstPickAt.current = at;
    const next = [...selected, key];
    setSelected(next);
    if (key === hintKey) setHintKey(null);
    playSound("uiClick");
    if (next.length === GROUP_SIZE) say("success", tile);
  };

  const shuffle = (at: number) => {
    if (wrongKeys) return;
    const rects = new Map<string, DOMRect>();
    for (const tile of remainingTiles) {
      const element = tileRefs.current.get(tile.key);
      if (element) rects.set(tile.key, element.getBoundingClientRect());
    }
    pendingShuffle.current = rects;
    setShuffleSeed((seed) => seed + 1);
    shuffleTimes.current = [...shuffleTimes.current.filter((time) => at - time < SHUFFLE_SPAM_WINDOW_MS), at];
    if (shuffleTimes.current.length >= SHUFFLE_SPAM_COUNT) {
      shuffleTimes.current = [];
      remark(lines.shuffleSpam, ["shuffle"], 1, { delay: SHUFFLE_RELEASE_MS });
    }
  };

  const submit = (button: HTMLElement, at: number) => {
    if (wrongKeys) return;
    setHintKey(null);
    const guessed = progress.guessKeys ?? [];
    if (guessed.some((keys) => guessId(keys) === guessId(selected))) {
      showToast({ text: copy.alreadyGuessed, negative: false });
      playSound("uiBack");
      remark(lines.repeat, ["repeat"], 1);
      return;
    }
    const levels = selected.map((key) => levelByKey.get(key) ?? 0);
    const correct = levels.every((level) => level === levels[0]);
    const quick = firstPickAt.current !== null && at - firstPickAt.current < FAST_SUBMIT_MS;
    const submitted = {
      guesses: [...progress.guesses, levels],
      guessKeys: [...guessed, [...selected]],
    };

    if (correct) {
      const solvedLevels = [...progress.solvedLevels, levels[0]];
      saveProgress({ ...progress, ...submitted, solvedLevels });
      setSelected([]);
      setFreshLevel(levels[0]);
      later(() => setFreshLevel((current) => (current === levels[0] ? null : current)), FRESH_TITLE_MS);
      say("success", button);
      playSound("gold");
      if (solvedLevels.length === puzzle.categories.length) {
        playSound("treasure");
        remark(
          progress.mistakes === 0 ? [gameCopy.vakuuApproval, ...lines.solvedPerfect] : lines.solved,
          ["result"],
          1,
          { force: true, delay: VAKUU_DELAY_MS },
        );
      } else if (levels[0] === PURPLE_LEVEL && progress.solvedLevels.length === 0) {
        remark(lines.hardGroup, ["result"], 0.9, { delay: VAKUU_DELAY_MS });
      } else {
        remark([gameCopy.vakuuApproval, ...lines.correct], ["result"], 0.45, { delay: VAKUU_DELAY_MS });
      }
      return;
    }

    const counts = new Map<number, number>();
    for (const level of levels) counts.set(level, (counts.get(level) ?? 0) + 1);
    const oneAway = [...counts.values()].some((count) => count === GROUP_SIZE - 1);
    setWrongKeys([...selected]);
    if (oneAway) showToast({ text: copy.oneAway, negative: true });
    say("forbidden", button);
    if (oneAway) remark(lines.oneAway, ["miss"], 0.7, { delay: VAKUU_DELAY_MS });
    else if (quick) remark(lines.fastSubmit, ["miss"], 0.6, { delay: VAKUU_DELAY_MS });
    else remark(lines.wrong, ["miss"], 0.3, { delay: VAKUU_DELAY_MS });

    const mistakes = progress.mistakes + 1;
    later(() => {
      setWrongKeys(null);
      saveProgress({ ...progress, ...submitted, mistakes });
      if (mistakes >= MISTAKE_LIMIT) {
        setSelected([]);
        playSound("merchantLaugh");
        remark(lines.failed, ["result"], 1, { force: true, delay: VAKUU_DELAY_MS });
      } else if (mistakes === MISTAKE_LIMIT - 1) {
        remark([gameCopy.vakuuWarning, ...lines.lastChance], ["warning"], 1, { force: true });
      }
    }, WRONG_FEEDBACK_MS);
  };

  const retry = () => {
    const retries = (progress.retries ?? 0) + 1;
    saveProgress({ ...emptyProgress(), retries });
    setSelected([]);
    setHintKey(null);
    playSound("uiBack");
    // VAKUU.talk.ANY counts visits; a third run onward may hear that this never ends.
    const visit = retries + 1;
    const pool = visit >= 3 && gameCopy.vakuuEndless
      ? [gameCopy.vakuuVisits, gameCopy.vakuuEndless]
      : [gameCopy.vakuuVisits];
    remark(pool, ["retry"], 1, { force: true, vars: { Visits: visit } });
  };

  const copyResult = async () => {
    const grid = progress.guesses
      .map((levels) => levels.map((level) => LEVEL_EMOJI[level]).join(""))
      .join("\n");
    const url = `${window.location.origin}${window.location.pathname}?p=${puzzle.number}`;
    try {
      await navigator.clipboard.writeText(
        `${gameCopy.title} ${copy.resultTitle} #${puzzle.number} · ${copy.mistakeCount} ${progress.mistakes}\n${grid}\n${url}`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const potions = progress.potions ?? fullBelt();
  const spendPotion = (slot: number) => {
    saveProgress({ ...progress, potions: potions.map((filled, index) => (index === slot ? false : filled)) });
  };

  const throwRock = (slot: number, from: HTMLElement) => {
    const key = rockTarget(selected, remainingTiles.map((tile) => tile.key), levelByKey);
    const target = key ? tileRefs.current.get(key) : null;
    if (!key || !target) return;
    spendPotion(slot);
    setHintKey(null);
    void playRockThrow(from.getBoundingClientRect(), target.getBoundingClientRect(), beltPotion.imageUrl).then(() => {
      playSound("rockHit");
      const landed = tileRefs.current.get(key);
      if (landed) playRockHit(landed);
      setHintKey(key);
    });
  };

  const discardRock = (slot: number) => {
    spendPotion(slot);
    playSound("rockDrop");
  };

  const changeDisplay = (next: ItemDisplay, id: keyof ItemDisplay) => {
    setDisplay(next);
    if (id === "token" && !next.token) remark(lines.tokensOff, ["display"], 1);
    if (localNamesDiffer && id === "local" && !next.local && next.original) {
      remark(lines.originalOnly, ["display"], 0.8);
    }
  };

  const countInspect = () => {
    inspectCount.current += 1;
    if (inspectCount.current === INSPECT_PEEK_COUNT) remark(lines.inspectPeek, ["inspect"], 1);
  };

  return (
    <section className="mx-auto max-w-2xl" data-connections-puzzle={puzzle.number}>
      <p className="mb-3 text-center text-sm font-semibold">{copy.guide}</p>
      <div className="mb-3 flex justify-center">
        <DisplayToggles
          display={display}
          gameLocale={gameLocale}
          labels={{ group: copy.viewsLabel, token: copy.viewTokens, local: copy.viewLocal, original: copy.viewOriginal }}
          onChange={changeDisplay}
        />
      </div>

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

      <div ref={boardRef} className="relative">
        {toast && (
          <p
            role="status"
            data-connections-toast
            className="absolute left-1/2 top-2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-3 py-1.5 font-game-title text-sm font-semibold text-white shadow-lg"
          >
            <RichText text={toast.negative ? `[red][jitter]${toast.text}[/jitter][/red]` : toast.text} />
          </p>
        )}

        <div className="space-y-2">
          {visibleCategories.map((category) => (
            <SolvedCategory
              key={category.level}
              category={category}
              display={display}
              fresh={category.level === freshLevel}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
            />
          ))}
        </div>

        {!finished && (
          <div className={`grid grid-cols-4 gap-1.5 sm:gap-2 ${visibleCategories.length > 0 ? "mt-2" : ""}`}>
            {remainingTiles.map((tile) => {
              const isSelected = selected.includes(tile.key);
              const isWrong = wrongKeys?.includes(tile.key) ?? false;
              return (
                <div
                  key={tile.key}
                  ref={(element) => {
                    if (element) tileRefs.current.set(tile.key, element);
                    else tileRefs.current.delete(tile.key);
                  }}
                  className="group relative"
                >
                  <button
                    type="button"
                    {...{ [CHARACTER_HAND_TARGET_ATTRIBUTE]: "" }}
                    aria-pressed={isSelected}
                    aria-label={tile.name}
                    onClick={(event) => toggleTile(tile.key, event.currentTarget, event.timeStamp)}
                    data-connections-hint={tile.key === hintKey && !isSelected ? "" : undefined}
                    className={`flex h-full min-h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-xs font-semibold transition-colors [word-break:keep-all] sm:min-h-20 sm:text-sm ${
                      tile.key === hintKey && !isSelected ? "connections-beckon " : ""
                    }${
                      isWrong
                        ? "connections-invalid-shake border-red-500 bg-red-950/90 text-red-300"
                        : isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card/90 text-foreground hover:border-primary/60"
                    }`}
                  >
                    <span className={`flex flex-col items-center gap-1 ${isWrong ? "connections-wrong-jitter" : ""}`}>
                      {display.token && tile.entity.imageUrl && (
                        <Image
                          src={tile.entity.imageUrl}
                          alt=""
                          width={72}
                          height={56}
                          className="h-12 w-16 object-contain sm:h-14 sm:w-[4.5rem]"
                        />
                      )}
                      <MemberLabels member={tile} display={display} />
                    </span>
                  </button>
                  <span
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") countInspect();
                    }}
                    onClick={countInspect}
                    className={`absolute right-0.5 top-0.5 transition-opacity group-hover:opacity-100 focus-within:opacity-100 ${
                      isSelected ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <EntityPreview
                      entity={tile.entity}
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                      disableLink
                      linkClassName="game-inspect-cursor flex h-7 w-7 items-center justify-center rounded"
                    >
                      <Image
                        src="/images/sts2/ui/cursor_inspect.png"
                        alt={`${tile.name} ${copy.inspect}`}
                        width={20}
                        height={20}
                        className="h-5 w-5"
                      />
                    </EntityPreview>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!finished && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 sm:gap-x-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {copy.remainingMistakes}
            <span
              className="flex gap-1"
              role="img"
              aria-label={`${MISTAKE_LIMIT - progress.mistakes}/${MISTAKE_LIMIT}`}
              data-connections-mistakes={MISTAKE_LIMIT - progress.mistakes}
            >
              {Array.from({ length: MISTAKE_LIMIT }, (_, index) => (
                <Image
                  key={index}
                  src={energyIcon}
                  alt=""
                  width={74}
                  height={69}
                  className={`h-6 w-6 object-contain transition-[filter,opacity] duration-300 ${
                    index < MISTAKE_LIMIT - progress.mistakes ? "" : "opacity-35 grayscale"
                  }`}
                />
              ))}
            </span>
          </div>
          <PotionBelt
            label={copy.potionBelt}
            potion={beltPotion}
            slots={potions}
            throwLabel={gameCopy.potionThrow}
            discardLabel={gameCopy.potionDiscard}
            disabled={wrongKeys !== null}
            onThrow={throwRock}
            onDiscard={discardRock}
          />
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 sm:gap-5">
            <PileButton
              pile="draw"
              count={shuffleCount ?? remainingTiles.length}
              label={copy.shuffle}
              disabled={wrongKeys !== null}
              onClick={(event) => shuffle(event.timeStamp)}
            />
            <PileButton
              pile="discard"
              count={selected.length}
              label={copy.deselect}
              disabled={selected.length === 0}
              onClick={() => {
                setSelected([]);
                playSound("uiBack");
              }}
            />
            <EndTurnButton
              label={copy.submit}
              ready={selected.length === GROUP_SIZE && wrongKeys === null}
              disabled={selected.length !== GROUP_SIZE || wrongKeys !== null}
              onClick={(event) => submit(event.currentTarget, event.timeStamp)}
            />
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
              onClick={retry}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/60"
            >
              {copy.retry}
            </button>
          </div>
        </div>
      )}

      <footer className="mt-6 flex flex-wrap justify-center gap-4 text-xs">
        <a
          href={localizeHrefWithGameLocale(neowsletterClaimHref(puzzle.issueId, puzzle.claimId), serviceLocale, gameLocale)}
          className="inline-flex items-center gap-1 spire-blue transition-colors hover:text-blue-300"
        >
          <Image src={NEOWSLETTER_TOKEN_SRC} alt="" width={16} height={16} className="h-4 w-4 rounded-sm object-cover" />
          {copy.sourceIssue.replace("{issue}", String(puzzle.issueNumber))} &rarr;
        </a>
        <a
          href={`https://custom-connections-game.vercel.app/${puzzle.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 spire-blue transition-colors hover:text-blue-300"
        >
          <Image src={MEGA_CRIT_TOKEN_SRC} alt="" width={16} height={16} className="h-4 w-4 rounded-sm" />
          {copy.sourcePuzzle} &rarr;
        </a>
      </footer>
    </section>
  );
}

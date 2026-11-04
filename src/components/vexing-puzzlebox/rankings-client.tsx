"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import Image from "@/components/ui/static-image";
import { profileTokenCharacter } from "@/components/vexing-puzzlebox/character-hand-pointer";
import { issueMonth } from "@/components/vexing-puzzlebox/connections-index";
import { displayItemLabels, hasLocalNames } from "@/components/vexing-puzzlebox/display-toggles";
import { usePuzzleboxSound } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import {
  usePuzzleboxLeaderboard,
  type PuzzleboxBoardStats,
  type PuzzleboxBoards,
  type PuzzleboxLeaderboard,
  type PuzzleboxRankRow,
} from "@/hooks/use-puzzlebox-scores";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { GAME_LOCALE_LABELS, localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
import {
  BETA_ART_TOKEN_SRC,
  CONNECTIONS_TOKEN_SRC,
  VEXING_PUZZLEBOX_BETA_ART_HREF,
  VEXING_PUZZLEBOX_HREF,
} from "@/lib/vexing-puzzlebox";
import {
  BETA_QUIZ_CORRECT_POINTS,
  BETA_QUIZ_DISPLAY_BONUS,
  BETA_QUIZ_LIFE_POINTS,
  BETA_QUIZ_SPEED_FULL_MS,
  BETA_QUIZ_SPEED_MAX,
  BETA_QUIZ_SPEED_ZERO_MS,
  BETA_QUIZ_STREAK_FROM,
  BETA_QUIZ_STREAK_POINTS,
  betaQuizMaxScore,
  CONNECTIONS_DISPLAY_BONUS,
  CONNECTIONS_LEVEL_POINTS,
  CONNECTIONS_MAX_SCORE,
  CONNECTIONS_MISTAKE_BONUS,
  CONNECTIONS_PURPLE_FIRST,
  CONNECTIONS_REVERSE_RAINBOW,
  CONNECTIONS_ROCK_PENALTY,
  type DisplayBonus,
  type PuzzleboxGame,
} from "@/lib/vexing-puzzlebox-score";
import type { RankingsConnectionsBoard, RankingsQuizSet } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const UI = "/images/sts2/ui/leaderboard";
const TROPHY_SRC = `${UI}/stats_trophy.webp`;
const BADGE_GOLD_SRC = `${UI}/badge_gold.webp`;
const BADGE_PERFECT_SRC = `${UI}/badge_perfect.webp`;
const CONFIRM_SRC = `${UI}/confirm_button.webp`;
const CONFIRM_TICK_SRC = `${UI}/confirm_button_tick.webp`;
const TIMER_SRC = "/images/sts2/ui/topbar/timer_icon.png";
/** daily_run_leaderboard_row.tscn and friends: cream rows, gold titles, a blue day label, gray rules. */
const CREAM = "text-[#fff6e2]";
const GOLD = "text-[#efc851]";
const BLUE = "text-[#85ceeb]";
const LEVEL_BAR = ["bg-amber-300", "bg-green-400", "bg-sky-400", "bg-violet-400"];
const ERA_TOKENS = { sts1: "/images/sts1_app_icon.png", sts2: "/images/sts2/icons/app_icon.png" } as const;
const PAGE_SIZE = 10;

type RankingsCopy = { [Key in keyof (typeof serviceMessages)["ko"]["vexingPuzzlebox"]["rankings"]]: string };

type Board = {
  /** Null for the game's totals. */
  id: string | null;
  label: string;
  title: string;
  subtitle: ReactNode;
  playHref: string;
};

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-";
}

function average(sum: number, count: number): string {
  return count > 0 ? (sum / count).toFixed(1).replace(/\.0$/, "") : "-";
}

function recordedAt(iso: string, serviceLocale: ServiceLocale): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat(serviceLocale === "ko" ? "ko-KR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
  return serviceLocale === "ko"
    ? `${date.getMonth() + 1}월 ${date.getDate()}일`
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/**
 * How a game scores, from the same numbers the scorer uses. The display bonus is explained
 * here only; the games keep it out of sight while playing.
 */
function ScoreRules({
  game,
  gameLocale,
  serviceLocale,
  copy,
}: {
  game: PuzzleboxGame;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  copy: RankingsCopy;
}) {
  const bonus: DisplayBonus = game === "connections" ? CONNECTIONS_DISPLAY_BONUS : BETA_QUIZ_DISPLAY_BONUS;
  const items = displayItemLabels(gameLocale, serviceLocale)
    .map((item) => fill(copy.ruleDisplayItem, { name: item.label, points: bonus[item.id] }))
    .join(" · ");
  const oneName = hasLocalNames(gameLocale)
    ? null
    : fill(copy.ruleOneName, { name: GAME_LOCALE_LABELS.eng[serviceLocale], points: bonus.local });
  const [yellow, green, blue, purple] = CONNECTIONS_LEVEL_POINTS;
  const [none, one, two] = CONNECTIONS_MISTAKE_BONUS;
  /** Each rule, with any notes on how it is counted under it. */
  const rules: { text: string; notes?: string[] }[] = game === "connections"
    ? [
      { text: fill(copy.ruleGroups, { yellow, green, blue, purple }) },
      { text: fill(copy.ruleClear, { none, one, two }) },
      { text: fill(copy.ruleOrder, { purple: CONNECTIONS_PURPLE_FIRST, rainbow: CONNECTIONS_REVERSE_RAINBOW }) },
      { text: fill(copy.ruleRocks, { rock: CONNECTIONS_ROCK_PENALTY }) },
      {
        text: fill(copy.ruleConnectionsDisplay, { items }),
        notes: [copy.ruleConnectionsShown, ...(oneName ? [oneName] : [])],
      },
    ]
    : [
      {
        text: fill(copy.ruleQuizCorrect, {
          correct: BETA_QUIZ_CORRECT_POINTS,
          streakFrom: BETA_QUIZ_STREAK_FROM,
          streak: BETA_QUIZ_STREAK_POINTS,
        }),
      },
      {
        text: fill(copy.ruleQuizSpeed, {
          max: BETA_QUIZ_SPEED_MAX,
          full: BETA_QUIZ_SPEED_FULL_MS / 1000,
          zero: BETA_QUIZ_SPEED_ZERO_MS / 1000,
        }),
      },
      { text: fill(copy.ruleQuizDisplay, { items }), notes: [copy.ruleQuizShown, ...(oneName ? [oneName] : [])] },
      { text: fill(copy.ruleQuizLives, { life: BETA_QUIZ_LIFE_POINTS }) },
    ];
  return (
    <div className="mt-5" data-rankings-score-rules={game}>
      <p className={`font-game-title text-lg font-semibold ${CREAM}`}>{copy.scoreRulesLabel}</p>
      <ul className={`mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed ${CREAM} opacity-85 marker:text-[#efc851]/70`}>
        {rules.map((rule) => (
          <li key={rule.text}>
            {rule.text}
            {rule.notes?.map((note) => (
              <span key={note} className="block opacity-70">{note}</span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two gray rules with a shadow, like NDailyRunLeaderboardSeparator. */
function Rule() {
  return <div aria-hidden="true" className="h-0.5 bg-[#807c71] shadow-[0_1px_0_rgba(0,0,0,0.25)]" />;
}

/** The game-over badge: a gold plate with the perfect figure on it. */
function PerfectBadge({ size = 22 }: { size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <Image src={BADGE_GOLD_SRC} alt="" width={size * 2} height={size * 2} className="absolute inset-0 h-full w-full object-contain" />
      <Image src={BADGE_PERFECT_SRC} alt="" width={size * 2} height={size * 2} className="absolute inset-0 h-full w-full object-contain" />
    </span>
  );
}

/** "[thinky_dots]" from MegaRichTextLabel: three dots taking turns. */
function ThinkyDots() {
  return (
    <span aria-hidden="true" className="inline-flex">
      {[0, 1, 2].map((index) => (
        <span key={index} className="animate-pulse" style={{ animationDelay: `${index * 200}ms` }}>.</span>
      ))}
    </span>
  );
}

/** One daily_run_screen_modifier: an icon and "[gold]Title:[/gold] description". */
function StatLine({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">{icon}</span>
      <span className={`min-w-0 text-sm ${CREAM}`}>
        <span className={`font-semibold ${GOLD}`}>{label}:</span> {children}
      </span>
    </li>
  );
}

function RankRow({
  row,
  total,
  serviceLocale,
}: {
  row: PuzzleboxRankRow;
  total: boolean;
  serviceLocale: ServiceLocale;
}) {
  return (
    <div
      className={`grid grid-cols-[2.75rem_minmax(0,1fr)_3.5rem_3rem_4rem] items-center gap-1 py-1.5 ${CREAM} ${row.is_me ? "bg-[#85ceeb]/10" : ""}`}
      data-rank-row={row.rank}
      data-rank-me={row.is_me ? "" : undefined}
    >
      <span className="pl-1 font-game-title text-lg font-bold tabular-nums">{row.rank}</span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <DisplayedProfileNickname
          nickname={row.nickname}
          isOwner={row.is_me}
          size={20}
          avatar_id={row.avatar_id}
          avatar_kind={row.avatar_kind}
          palette_id={row.palette_id}
          palette_swapped={row.palette_swapped}
          className="min-w-0"
          nicknameClassName={`truncate text-sm sm:text-base ${row.is_me ? BLUE : ""}`}
        />
        <span className="shrink-0 text-[10px] tabular-nums text-white/30">#{row.tag}</span>
      </span>
      <span className="text-right font-game-title text-lg font-bold tabular-nums">{row.score}</span>
      <span className="flex justify-center text-sm tabular-nums">
        {total ? (row.perfect_count > 0 ? row.perfect_count : "") : row.perfect ? <PerfectBadge /> : ""}
      </span>
      <span className="pr-1 text-right text-xs tabular-nums text-[#fff6e2]/70">{recordedAt(row.achieved_at, serviceLocale)}</span>
    </div>
  );
}

function ConnectionsStats({
  stats,
  board,
  energyIcon,
  copy,
}: {
  stats: PuzzleboxBoardStats;
  board: RankingsConnectionsBoard;
  energyIcon: string;
  copy: RankingsCopy;
}) {
  const people = (count: number) => copy.peopleValue.replace("{count}", String(count));
  return (
    <>
      <StatLine icon={<Image src={TROPHY_SRC} alt="" width={64} height={64} className="h-9 w-9 object-contain" />} label={copy.statPlayers}>
        {people(stats.players)}
      </StatLine>
      <StatLine icon={<Image src={CONNECTIONS_TOKEN_SRC} alt="" width={64} height={64} className="h-9 w-9 object-contain" />} label={copy.statCleared}>
        {percent(stats.cleared, stats.players)} · {copy.statAvgScore} {average(stats.score_sum, stats.players)}
      </StatLine>
      <StatLine icon={<PerfectBadge size={34} />} label={copy.statPerfect}>
        {percent(stats.perfect, stats.players)}
      </StatLine>
      <StatLine icon={<Image src={energyIcon} alt="" width={64} height={64} className="h-8 w-8 object-contain" />} label={copy.statAvgMistakes}>
        {average(stats.mistakes_sum, stats.players)}
      </StatLine>
      <StatLine icon={<span className="h-7 w-7 rounded bg-violet-400" />} label={copy.statPurpleFirst}>
        {percent(stats.purple_first, stats.players)}
      </StatLine>
      <li className="pl-[3.25rem]">
        <p className={`text-sm font-semibold ${GOLD}`}>{copy.statLevels}:</p>
        <ul className="mt-1 space-y-1">
          {board.levels.map((title, level) => {
            const solved = stats.level_solved[level] ?? 0;
            return (
              <li key={level} className={`grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2 text-xs ${CREAM}`}>
                <span className="truncate">{title}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={`block h-full ${LEVEL_BAR[level]}`}
                    style={{ width: stats.players > 0 ? `${(solved / stats.players) * 100}%` : 0 }}
                  />
                </span>
                <span className="text-right tabular-nums">{percent(solved, stats.players)}</span>
              </li>
            );
          })}
        </ul>
      </li>
    </>
  );
}

function QuizStats({
  stats,
  set,
  copy,
}: {
  stats: PuzzleboxBoardStats;
  set: RankingsQuizSet;
  copy: RankingsCopy;
}) {
  const people = (count: number) => copy.peopleValue.replace("{count}", String(count));
  const hardest = stats.question_wrong.reduce(
    (best, count, index) => (count > best.count ? { index, count } : best),
    { index: -1, count: 0 },
  );
  const commonPick = stats.wrong_picks.reduce(
    (best, count, slot) => (count > best.count ? { slot, count } : best),
    { slot: -1, count: 0 },
  );
  const hardestQuestion = hardest.index >= 0 ? set.questions[hardest.index] : null;
  const pickQuestion = commonPick.slot >= 0 ? set.questions[Math.floor(commonPick.slot / 4)] : null;
  const pickName = pickQuestion?.choices[commonPick.slot % 4];
  return (
    <>
      <StatLine icon={<Image src={TROPHY_SRC} alt="" width={64} height={64} className="h-9 w-9 object-contain" />} label={copy.statPlayers}>
        {people(stats.players)}
      </StatLine>
      <StatLine icon={<Image src={BETA_ART_TOKEN_SRC} alt="" width={64} height={64} className="h-9 w-9 object-contain" />} label={copy.statQuizCleared}>
        {percent(stats.cleared, stats.players)} · {copy.statAvgScore} {average(stats.score_sum, stats.players)}
      </StatLine>
      <StatLine icon={<PerfectBadge size={34} />} label={copy.statQuizPerfect}>
        {percent(stats.perfect, stats.players)}
      </StatLine>
      {hardestQuestion && (
        <StatLine
          icon={<Image src={hardestQuestion.betaUrl} alt="" width={80} height={60} className="h-9 w-10 rounded-sm object-cover" />}
          label={copy.statHardestArt}
        >
          {hardestQuestion.name} ({percent(hardest.count, stats.players)})
        </StatLine>
      )}
      {pickQuestion && pickName && (
        <StatLine
          icon={<Image src={pickQuestion.betaUrl} alt="" width={80} height={60} className="h-9 w-10 rounded-sm object-cover" />}
          label={copy.statCommonMistake}
        >
          {copy.commonMistakeValue.replace("{answer}", pickQuestion.name).replace("{pick}", pickName)} ({people(commonPick.count)})
        </StatLine>
      )}
    </>
  );
}

/**
 * The puzzlebox rankings, laid out like the game's Daily Challenge screen: the challenge
 * on the left (title, date, statistics where the modifiers sit, the player, and a confirm
 * button), the leaderboard on the right with its paginator, header icons, ruled rows,
 * page arrows, and a tickbox to jump to the player's own rank.
 */
export function RankingsClient({
  connections,
  quizSets,
  gameCopy,
  serviceLocale,
  gameLocale,
}: {
  connections: RankingsConnectionsBoard[];
  quizSets: RankingsQuizSet[];
  gameCopy: VexingPuzzleboxGameCopy;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const puzzleboxCopy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const copy = puzzleboxCopy.rankings;
  const playSound = usePuzzleboxSound();
  const { stored, profile } = useStoredProfileSnapshot();
  const energyIcon = resolveSts2EnergyIcon(profileTokenCharacter(stored, profile) ?? "colorless");
  const [game, setGame] = useState<PuzzleboxGame>("connections");
  /** Index into the game's boards; 0 is the totals, 1 the latest puzzle or the first set. */
  const [boardIndex, setBoardIndex] = useState(1);
  const [offset, setOffset] = useState(0);
  const [aroundMe, setAroundMe] = useState(false);

  const connectionsBoards = useMemo<PuzzleboxBoards>(
    () => Object.fromEntries(connections.map((board) => [String(board.number), CONNECTIONS_MAX_SCORE])),
    [connections],
  );
  const quizBoards = useMemo<PuzzleboxBoards>(
    () => Object.fromEntries(quizSets.map((set) => [String(set.number), betaQuizMaxScore(set.questions.length)])),
    [quizSets],
  );

  const boards = useMemo<Board[]>(() => {
    const local = (href: string) => localizeHrefWithGameLocale(href, serviceLocale, gameLocale);
    if (game === "connections") {
      return [
        {
          id: null,
          label: copy.total,
          title: copy.totalTitle.replace("{game}", copy.gameConnections),
          subtitle: copy.totalBoards.replace("{count}", String(connections.length)),
          playHref: `${local(VEXING_PUZZLEBOX_HREF)}?list`,
        },
        ...connections.map((board) => ({
          id: String(board.number),
          label: `#${board.number}`,
          title: copy.boardConnections.replace("{number}", String(board.number)),
          subtitle: (
            <span className="inline-flex items-center gap-1.5">
              <Image src={ERA_TOKENS[board.era]} alt={board.era.toUpperCase()} width={32} height={32} className="h-5 w-5 object-contain" />
              {issueMonth(board.issueDate, serviceLocale)}
            </span>
          ),
          playHref: `${local(VEXING_PUZZLEBOX_HREF)}?p=${board.number}`,
        })),
      ];
    }
    return [
      {
        id: null,
        label: copy.total,
        title: copy.totalTitle.replace("{game}", copy.gameBetaQuiz),
        subtitle: copy.totalBoards.replace("{count}", String(quizSets.length)),
        playHref: `${local(VEXING_PUZZLEBOX_BETA_ART_HREF)}?mode=quiz`,
      },
      ...quizSets.map((set) => ({
        id: String(set.number),
        label: copy.boardQuizShort.replace("{number}", String(set.number)),
        title: copy.boardQuiz.replace("{number}", String(set.number)),
        subtitle: copy.quizSize.replace("{count}", String(set.questions.length)),
        playHref: `${local(VEXING_PUZZLEBOX_BETA_ART_HREF)}?mode=quiz&set=${set.number}`,
      })),
    ];
  }, [game, connections, quizSets, copy, serviceLocale, gameLocale]);

  // ?game=beta-quiz&board=3 (or board=total) opens that board; the score summary links here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedGame = params.get("game") === "beta-quiz" ? "beta-quiz" : "connections";
    const requestedBoard = params.get("board");
    const ids = requestedGame === "connections"
      ? [null, ...connections.map((board) => String(board.number))]
      : [null, ...quizSets.map((set) => String(set.number))];
    const index = requestedBoard === null ? 1 : requestedBoard === "total" ? 0 : ids.indexOf(requestedBoard);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the board lives in the URL of a static page
    setGame(requestedGame);
    if (index >= 0) setBoardIndex(index);
  }, [connections, quizSets]);

  const board = boards[Math.min(boardIndex, boards.length - 1)];
  const { data, loading, failed } = usePuzzleboxLeaderboard({
    game,
    boards: game === "connections" ? connectionsBoards : quizBoards,
    board: board.id,
    offset,
    aroundMe,
  });

  const showBoard = (nextGame: PuzzleboxGame, nextIndex: number) => {
    setGame(nextGame);
    setBoardIndex(nextIndex);
    setOffset(0);
    setAroundMe(false);
    playSound("uiClick");
    const url = new URL(window.location.href);
    const ids = nextGame === "connections"
      ? connections.map((item) => String(item.number))
      : quizSets.map((item) => String(item.number));
    url.searchParams.set("game", nextGame);
    url.searchParams.set("board", nextIndex === 0 ? "total" : ids[nextIndex - 1] ?? "total");
    window.history.replaceState(window.history.state, "", url);
  };

  const leaderboard: PuzzleboxLeaderboard | null = data;
  const rows = leaderboard?.rows ?? [];
  const me = leaderboard?.me ?? null;
  const meShown = rows.some((row) => row.is_me);
  const pageStart = leaderboard?.offset ?? offset;
  const players = leaderboard?.players ?? 0;
  const stats = leaderboard?.stats ?? null;
  const connectionsBoard = game === "connections" && board.id ? connections.find((item) => String(item.number) === board.id) : null;
  const quizSet = game === "beta-quiz" && board.id ? quizSets.find((item) => String(item.number) === board.id) : null;
  const arrowClass = "flex h-9 w-9 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-transform enabled:hover:scale-110 disabled:opacity-25";
  const games: { id: PuzzleboxGame; label: string; icon: string }[] = [
    { id: "connections", label: copy.gameConnections, icon: CONNECTIONS_TOKEN_SRC },
    { id: "beta-quiz", label: copy.gameBetaQuiz, icon: BETA_ART_TOKEN_SRC },
  ];

  return (
    <section className="mx-auto max-w-5xl" data-puzzlebox-rankings={game} data-rankings-board={board.id ?? "total"}>
      <div role="tablist" aria-label={copy.gamesLabel} className="mb-5 flex justify-center gap-6">
        {games.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={game === item.id}
            onClick={() => showBoard(item.id, 1)}
            className={`flex items-center gap-2 font-game-title text-base transition-opacity ${
              game === item.id ? `${GOLD} font-semibold` : "text-muted-foreground opacity-70 hover:opacity-100"
            }`}
          >
            <Image src={item.icon} alt="" width={56} height={56} className={`h-7 w-7 object-contain ${game === item.id ? "" : "grayscale"}`} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {/* The challenge: NDailyRunScreen's left half. */}
        <div className="order-2 lg:order-1">
          <h2 className={`text-center font-game-title text-3xl font-bold drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-4xl ${GOLD}`}>
            {board.title}
          </h2>
          <p className={`mt-1 flex justify-center text-sm ${CREAM}`}>{board.subtitle}</p>

          <div className="mt-5">
            <p className={`font-game-title text-lg font-semibold ${CREAM}`}>{copy.statsLabel}</p>
            {loading && !stats ? (
              <p className="mt-2 text-sm text-[#7fff00]">{gameCopy.leaderboardFetching}<ThinkyDots /></p>
            ) : board.id === null ? (
              <ul className="mt-2 space-y-2">
                <StatLine icon={<Image src={TROPHY_SRC} alt="" width={64} height={64} className="h-9 w-9 object-contain" />} label={copy.statPlayers}>
                  {copy.peopleValue.replace("{count}", String(players))}
                </StatLine>
                {me && (
                  <StatLine icon={<PerfectBadge size={34} />} label={copy.statMyBoards}>
                    {copy.totalBoards.replace("{count}", String(me.boards))} · {puzzleboxCopy.rankings.perfectHeader} {me.perfect_count}
                  </StatLine>
                )}
              </ul>
            ) : stats && stats.players > 0 ? (
              <>
                <ul className="mt-2 space-y-2">
                  {connectionsBoard && <ConnectionsStats stats={stats} board={connectionsBoard} energyIcon={energyIcon} copy={copy} />}
                  {quizSet && <QuizStats stats={stats} set={quizSet} copy={copy} />}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">{copy.statsNote}</p>
              </>
            ) : (
              <p className={`mt-2 text-sm ${CREAM} opacity-70`}>{failed ? copy.unavailable : copy.noStats}</p>
            )}
          </div>

          <ScoreRules game={game} gameLocale={gameLocale} serviceLocale={serviceLocale} copy={copy} />

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${GOLD}`}>{copy.myRecord}</p>
              {me ? (
                <p className={`mt-1 flex items-baseline gap-2 ${CREAM}`}>
                  <DisplayedProfileNickname
                    nickname={me.nickname}
                    isOwner
                    size={22}
                    nicknameClassName={`text-sm ${BLUE}`}
                  />
                  <span className="font-game-title text-xl font-bold tabular-nums">{me.score}</span>
                  <span className="text-xs tabular-nums opacity-80">
                    {puzzleboxCopy.rankLine.replace("{rank}", String(me.rank)).replace("{players}", String(players))}
                  </span>
                </p>
              ) : (
                <p className={`mt-1 text-sm ${CREAM} opacity-70`}>-</p>
              )}
            </div>
            <Link
              href={board.playHref}
              prefetch={false}
              className="group relative flex h-16 w-32 shrink-0 items-center justify-center transition-transform hover:scale-105"
              aria-label={board.id === null ? copy.playList : copy.play}
            >
              <Image src={CONFIRM_SRC} alt="" width={257} height={132} className="absolute inset-0 h-full w-full object-contain" />
              <span className="relative flex items-center gap-1.5 font-game-title text-base font-bold text-[#fff6e2] drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
                <Image src={CONFIRM_TICK_SRC} alt="" width={48} height={40} className="h-5 w-6 object-contain" />
                {board.id === null ? copy.playList : copy.play}
              </span>
            </Link>
          </div>
        </div>

        {/* The leaderboard: NDailyRunLeaderboard. */}
        <div className="order-1 lg:order-2">
          <h2 className={`text-center font-game-title text-3xl font-bold drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] ${GOLD}`}>
            {gameCopy.leaderboardTitle}
          </h2>
          <div className="mt-2 flex items-center justify-center gap-1">
            <button
              type="button"
              aria-label={puzzleboxCopy.previous}
              disabled={boardIndex <= 0}
              onClick={() => showBoard(game, boardIndex - 1)}
              className={arrowClass}
            >
              <Image src="/images/sts2/ui/settings_tiny_left_arrow.png" alt="" width={32} height={32} className="object-contain" />
            </button>
            <p className={`min-w-32 text-center font-game-title text-xl font-bold ${BLUE}`} data-rankings-board-label>
              {board.label}
            </p>
            <button
              type="button"
              aria-label={puzzleboxCopy.next}
              disabled={boardIndex >= boards.length - 1}
              onClick={() => showBoard(game, boardIndex + 1)}
              className={arrowClass}
            >
              <Image src="/images/sts2/ui/settings_tiny_right_arrow.png" alt="" width={32} height={32} className="object-contain" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[2.75rem_minmax(0,1fr)_3.5rem_3rem_4rem] items-end gap-1 pb-1.5" aria-hidden="true">
            <GameUiHoverTip label={gameCopy.leaderboardRank}>
              <Image src={TROPHY_SRC} alt="" width={64} height={64} className="h-8 w-8 object-contain" />
            </GameUiHoverTip>
            <span className={`font-game-title text-lg font-bold ${CREAM}`}>{gameCopy.leaderboardName}</span>
            <span className={`text-right font-game-title text-sm font-bold ${CREAM}`}>{gameCopy.leaderboardScore}</span>
            <span className="flex justify-center">
              <GameUiHoverTip label={copy.perfectHeader}>
                <PerfectBadge size={26} />
              </GameUiHoverTip>
            </span>
            <span className="flex justify-end pr-1">
              <GameUiHoverTip label={copy.timeHeader}>
                <Image src={TIMER_SRC} alt="" width={56} height={56} className="h-6 w-6 object-contain" />
              </GameUiHoverTip>
            </span>
          </div>
          <Rule />

          <div className="relative min-h-[26rem]" data-rankings-rows={rows.length}>
            {loading && rows.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center font-game-title text-xl font-bold text-[#7fff00] drop-shadow-[0_2px_0_rgba(40,64,19,0.75)]">
                {gameCopy.leaderboardFetching}
                <ThinkyDots />
              </p>
            ) : failed ? (
              <p className={`absolute inset-0 flex items-center justify-center text-center font-game-title text-lg ${CREAM}`}>
                {copy.unavailable}
              </p>
            ) : rows.length === 0 ? (
              <p className={`absolute inset-0 flex items-center justify-center text-center font-game-title text-lg ${CREAM}`}>
                {gameCopy.leaderboardEmpty}
              </p>
            ) : (
              <div className={loading ? "opacity-50 transition-opacity" : ""}>
                {rows.map((row) => (
                  <div key={`${row.rank}-${row.tag}`}>
                    <RankRow row={row} total={board.id === null} serviceLocale={serviceLocale} />
                    <Rule />
                  </div>
                ))}
                {me && !meShown && (
                  <div className="mt-3">
                    <Rule />
                    <RankRow row={me} total={board.id === null} serviceLocale={serviceLocale} />
                    <Rule />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              aria-label={copy.previousPage}
              disabled={pageStart <= 0 || loading}
              onClick={() => {
                setAroundMe(false);
                setOffset(Math.max(0, pageStart - PAGE_SIZE));
                playSound("uiClick");
              }}
              className={arrowClass}
            >
              <Image src="/images/sts2/ui/settings_tiny_left_arrow.png" alt="" width={32} height={32} className="rotate-90 object-contain" />
            </button>
            <GameCheckboxToggle
              checked={aroundMe}
              label={copy.aroundMe}
              disabled={!me}
              onCheckedChange={(checked) => {
                setAroundMe(checked);
                setOffset(0);
                playSound(checked ? "checkboxOn" : "checkboxOff");
              }}
              labelClassName={GOLD}
            />
            <button
              type="button"
              aria-label={copy.nextPage}
              disabled={pageStart + PAGE_SIZE >= players || loading}
              onClick={() => {
                setAroundMe(false);
                setOffset(pageStart + PAGE_SIZE);
                playSound("uiClick");
              }}
              className={arrowClass}
            >
              <Image src="/images/sts2/ui/settings_tiny_right_arrow.png" alt="" width={32} height={32} className="rotate-90 object-contain" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

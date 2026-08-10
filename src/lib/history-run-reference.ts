import type {
  HistoryRunBlock,
  HistoryRunReferenceSnapshot,
} from "@/lib/chemical-types";
import type { DonatedRunSummary } from "@/lib/run-donation";
import type { ServiceLocale } from "@/lib/i18n";
import { ensureCoverSpec } from "@/lib/run-cover-suggest";
import type { ReplayRun } from "@/lib/sts2-run-replay";

const CHARACTER_LABELS: Record<ServiceLocale, Record<string, string>> = {
  ko: {
    "CHARACTER.IRONCLAD": "아이언클래드",
    "CHARACTER.SILENT": "사일런트",
    "CHARACTER.DEFECT": "디펙트",
    "CHARACTER.NECROBINDER": "네크로바인더",
    "CHARACTER.REGENT": "리젠트",
  },
  en: {
    "CHARACTER.IRONCLAD": "Ironclad",
    "CHARACTER.SILENT": "Silent",
    "CHARACTER.DEFECT": "Defect",
    "CHARACTER.NECROBINDER": "Necrobinder",
    "CHARACTER.REGENT": "Regent",
  },
};

export const HISTORY_RUN_CHARACTER_PORTRAITS: Record<string, string> = {
  "CHARACTER.IRONCLAD": "/images/sts2/characters/char_select_ironclad.webp",
  "CHARACTER.SILENT": "/images/sts2/characters/char_select_silent.webp",
  "CHARACTER.DEFECT": "/images/sts2/characters/char_select_defect.webp",
  "CHARACTER.NECROBINDER": "/images/sts2/characters/char_select_necrobinder.webp",
  "CHARACTER.REGENT": "/images/sts2/characters/char_select_regent.webp",
};

export const HISTORY_COURSE_RELIC_IMAGE = "/images/sts2/relics/history_course.webp";

function totalFloorsFromRun(run: ReplayRun): number {
  return run.map_point_history.reduce((total, act) => total + act.length, 0);
}

export function historyRunSnapshotFromReplay(
  run: ReplayRun,
  runId?: string,
): HistoryRunReferenceSnapshot {
  return {
    title: null,
    character: run.players[0]?.character ?? "",
    startTime: run.start_time ?? null,
    ascension: run.ascension,
    win: run.win,
    totalFloors: totalFloorsFromRun(run),
    runTime: run.run_time ?? null,
    build: run.build_id,
    seed: run.seed,
    coverSpec: runId ? ensureCoverSpec(runId, run, null) : null,
  };
}

export function historyRunSnapshotFromSummary(
  run: DonatedRunSummary,
): HistoryRunReferenceSnapshot {
  return {
    title: null,
    character: run.character,
    startTime: run.start_time,
    ascension: run.ascension,
    win: run.win,
    totalFloors: run.total_floors,
    runTime: run.run_time,
    build: run.build,
    seed: run.seed,
    coverSpec: run.cover_spec ?? null,
  };
}

export function historyRunBlockFromReplay(runId: string, run: ReplayRun): HistoryRunBlock {
  return {
    type: "history-run",
    runId,
    snapshot: historyRunSnapshotFromReplay(run, runId),
  };
}

export function historyRunBlockFromSummary(
  run: DonatedRunSummary,
): HistoryRunBlock {
  return {
    type: "history-run",
    runId: run.id,
    snapshot: historyRunSnapshotFromSummary(run),
  };
}

export function historyRunCharacterLabel(
  character: string,
  serviceLocale: ServiceLocale,
): string {
  return CHARACTER_LABELS[serviceLocale][character]
    ?? character.replace(/^CHARACTER\./, "")
    ?? character;
}

export function historyRunDateLabel(
  startTime: number | null,
  serviceLocale: ServiceLocale,
  includeTime = true,
): string {
  if (startTime == null || !Number.isFinite(startTime)) {
    return serviceLocale === "ko" ? "날짜 없음" : "Date unavailable";
  }

  const date = new Date(startTime * 1000);
  return new Intl.DateTimeFormat(
    serviceLocale === "ko" ? "ko-KR" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    },
  ).format(date);
}

export function historyRunShortCode(runId: string): string {
  return runId.slice(-4).toUpperCase();
}

export function historyRunPrimaryLabel(
  block: HistoryRunBlock,
  serviceLocale: ServiceLocale,
): string {
  const title = block.snapshot.title?.trim();
  if (title) return title;
  return [
    historyRunCharacterLabel(block.snapshot.character, serviceLocale),
    historyRunDateLabel(block.snapshot.startTime, serviceLocale),
    serviceLocale === "ko"
      ? `승천 ${block.snapshot.ascension}`
      : `Ascension ${block.snapshot.ascension}`,
  ].join(" · ");
}

export function historyRunSecondaryLabel(
  block: HistoryRunBlock,
  serviceLocale: ServiceLocale,
): string {
  const result = block.snapshot.win
    ? (serviceLocale === "ko" ? "승리" : "Victory")
    : (serviceLocale === "ko" ? "패배" : "Defeat");
  const floors = serviceLocale === "ko"
    ? `${block.snapshot.totalFloors}층`
    : `${block.snapshot.totalFloors} floors`;
  return `${result} · ${floors} · #${historyRunShortCode(block.runId)}`;
}

export function historyRunPlainText(
  block: HistoryRunBlock,
  serviceLocale: ServiceLocale = "ko",
): string {
  return historyRunPrimaryLabel(block, serviceLocale);
}

export function historyRunSearchText(
  block: HistoryRunBlock,
  serviceLocale: ServiceLocale,
): string {
  const isoDate = block.snapshot.startTime == null
    ? ""
    : new Date(block.snapshot.startTime * 1000).toISOString().slice(0, 16);
  return [
    historyRunPrimaryLabel(block, serviceLocale),
    historyRunSecondaryLabel(block, serviceLocale),
    isoDate,
    block.runId,
    block.snapshot.seed,
    block.snapshot.build,
    block.snapshot.character,
  ].join(" ").toLowerCase();
}

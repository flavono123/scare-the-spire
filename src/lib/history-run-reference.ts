import type {
  HistoryRunBlock,
  HistoryRunReferenceSnapshot,
} from "@/lib/chemical-types";
import type { DonatedRunSummary } from "@/lib/run-donation";
import type { ServiceLocale } from "@/lib/i18n";
import { ensureCoverSpec } from "@/lib/run-cover-suggest";
import { displayNameForCoverElement } from "@/lib/run-cover-display";
import type { CoverSpec } from "@/lib/run-cover-types";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";

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
  existingCover?: CoverSpec | null,
): HistoryRunReferenceSnapshot {
  return {
    title: null,
    character: run.players[0]?.character ?? "",
    characters: run.players.map((player) => player.character),
    startTime: run.start_time ?? null,
    ascension: run.ascension,
    win: run.win,
    totalFloors: totalFloorsFromRun(run),
    runTime: run.run_time ?? null,
    build: run.build_id,
    seed: run.seed,
    coverSpec: runId ? ensureCoverSpec(runId, run, existingCover) : null,
  };
}

export function historyRunSnapshotFromSummary(
  run: DonatedRunSummary,
): HistoryRunReferenceSnapshot {
  let coverSpec = run.cover_spec ?? null;
  if ((!coverSpec || coverSpec.auto !== false) && run.raw) {
    try {
      coverSpec = ensureCoverSpec(run.id, parseReplayRun(run.raw), coverSpec);
    } catch {
      // keep stored cover_spec
    }
  }
  return {
    title: null,
    character: run.character,
    characters: run.characters ?? [run.character],
    startTime: run.start_time,
    ascension: run.ascension,
    win: run.win,
    totalFloors: run.total_floors,
    runTime: run.run_time,
    build: run.build,
    seed: run.seed,
    coverSpec,
  };
}

export function historyRunBlockFromReplay(
  runId: string,
  run: ReplayRun,
  existingCover?: CoverSpec | null,
): HistoryRunBlock {
  return {
    type: "history-run",
    runId,
    snapshot: historyRunSnapshotFromReplay(run, runId, existingCover),
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
  const cover = block.snapshot.coverSpec;
  return [
    historyRunPrimaryLabel(block, serviceLocale),
    historyRunSecondaryLabel(block, serviceLocale),
    cover?.phrase,
    ...(cover?.elements.map((el) => el.id) ?? []),
    isoDate,
    block.runId,
    block.snapshot.seed,
    block.snapshot.build,
    block.snapshot.character,
    ...(block.snapshot.characters ?? []),
  ].join(" ").toLowerCase();
}

/** Phrase tokens (+ B-background card name) for combo composer keyword insert. */
export function keywordsFromCoverSpec(cover: CoverSpec | null | undefined): string[] {
  if (!cover) return [];
  const tokens: string[] = [];
  for (const part of cover.phrase.split(/\s+/)) {
    const trimmed = part.trim();
    if (trimmed) tokens.push(trimmed);
  }
  if (cover.background.kind === "card-beta") {
    const cardName = displayNameForCoverElement({
      kind: "card",
      id: cover.background.cardId,
    }).trim();
    if (cardName) tokens.push(cardName);
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(token);
  }
  return unique;
}

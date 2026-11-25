import borrowedGameCopyPayload from "@/generated/borrowed-game-copy.json";
import type { GameLocale } from "@/lib/i18n";
import type {
  BorrowedGameCopyPayload,
  DebateGameCopy,
  DecisionsDecisionsGameCopy,
  DefragmentGameCopy,
  FeedbackFormGameCopy,
  HistoryCourseLandingGameCopy,
  PagestormGameCopy,
  PatchBackstabGameCopy,
  PatchStageGameCopy,
  ThisOrThatGameCopy,
  TransfigureGameCopy,
  VexingPuzzleboxGameCopy,
} from "@/lib/borrowed-game-copy-types";

export type {
  DebateGameCopy,
  DecisionsDecisionsGameCopy,
  DefragmentGameCopy,
  FeedbackFormGameCopy,
  HistoryCourseLandingGameCopy,
  PagestormGameCopy,
  PatchBackstabGameCopy,
  PatchStageGameCopy,
  ThisOrThatGameCopy,
  TransfigureGameCopy,
  VexingPuzzleboxGameCopy,
};

const ENGLISH_GAME_LOCALE: GameLocale = "eng";

const borrowedGameCopy = borrowedGameCopyPayload as Record<GameLocale, BorrowedGameCopyPayload>;

function getBorrowedGameCopy(gameLocale: GameLocale): BorrowedGameCopyPayload {
  return borrowedGameCopy[gameLocale] ?? borrowedGameCopy[ENGLISH_GAME_LOCALE];
}

export async function getChemicalXPlaceholder(
  gameLocale: GameLocale,
): Promise<string> {
  return getBorrowedGameCopy(gameLocale).chemicalXPlaceholder;
}

export async function getComboPlaceholder(
  gameLocale: GameLocale,
): Promise<string> {
  return getBorrowedGameCopy(gameLocale).comboPlaceholder;
}

export async function getFeedbackFormGameCopy(
  gameLocale: GameLocale,
): Promise<FeedbackFormGameCopy> {
  return getBorrowedGameCopy(gameLocale).feedbackForm;
}

export async function getPatchStageGameCopy(
  gameLocale: GameLocale,
): Promise<PatchStageGameCopy> {
  return getBorrowedGameCopy(gameLocale).patchStage;
}

export async function getPatchBackstabGameCopy(
  gameLocale: GameLocale,
): Promise<PatchBackstabGameCopy> {
  return getBorrowedGameCopy(gameLocale).patchBackstab;
}

export async function getHistoryCourseLandingGameCopy(
  gameLocale: GameLocale,
): Promise<HistoryCourseLandingGameCopy> {
  return getBorrowedGameCopy(gameLocale).historyCourseLanding;
}

export async function getThisOrThatGameCopy(
  gameLocale: GameLocale,
): Promise<ThisOrThatGameCopy> {
  return getBorrowedGameCopy(gameLocale).thisOrThat;
}

export async function getTransfigureGameCopy(
  gameLocale: GameLocale,
): Promise<TransfigureGameCopy> {
  return getBorrowedGameCopy(gameLocale).transfigure;
}

export function getTransfigureNavTitle(gameLocale: GameLocale): string {
  return getBorrowedGameCopy(gameLocale).transfigure.title;
}

export async function getDefragmentGameCopy(
  gameLocale: GameLocale,
): Promise<DefragmentGameCopy> {
  return getBorrowedGameCopy(gameLocale).defragment;
}

export function getDefragmentNavTitle(gameLocale: GameLocale): string {
  return getBorrowedGameCopy(gameLocale).defragment.title;
}

export async function getDecisionsDecisionsGameCopy(
  gameLocale: GameLocale,
): Promise<DecisionsDecisionsGameCopy> {
  return getBorrowedGameCopy(gameLocale).decisionsDecisions;
}

export function getDecisionsDecisionsNavTitle(gameLocale: GameLocale): string {
  return getBorrowedGameCopy(gameLocale).decisionsDecisions.title;
}

export async function getPagestormGameCopy(
  gameLocale: GameLocale,
): Promise<PagestormGameCopy> {
  return getBorrowedGameCopy(gameLocale).pagestorm;
}

export async function getVexingPuzzleboxGameCopy(
  gameLocale: GameLocale,
): Promise<VexingPuzzleboxGameCopy> {
  return getBorrowedGameCopy(gameLocale).vexingPuzzlebox;
}

export function getVexingPuzzleboxNavTitle(gameLocale: GameLocale): string {
  return getBorrowedGameCopy(gameLocale).vexingPuzzlebox.title;
}

export function getPagestormNavTitle(gameLocale: GameLocale): string {
  return getBorrowedGameCopy(gameLocale).pagestorm.title;
}

export async function getDebateGameCopy(
  gameLocale: GameLocale,
): Promise<DebateGameCopy> {
  return getBorrowedGameCopy(gameLocale).debate;
}

export function getDebateNavTitle(gameLocale: GameLocale): string {
  return getBorrowedGameCopy(gameLocale).debate.title;
}

import borrowedGameCopyPayload from "@/generated/borrowed-game-copy.json";
import type { GameLocale } from "@/lib/i18n";

const ENGLISH_GAME_LOCALE: GameLocale = "eng";

export interface HistoryCourseLandingGameCopy {
  title: string;
  runHistoryLabel: string;
  heroQuote: string;
}

export interface ThisOrThatGameCopy {
  title: string;
  prompt: string;
}

export interface PatchStageGameCopy {
  prepTime: {
    title: string;
    description: string;
  };
  delay: {
    title: string;
    description: string;
  };
  workToolsTitle: string;
}

interface BorrowedGameCopyPayload {
  chemicalXPlaceholder: string;
  comboPlaceholder: string;
  historyCourseLanding: HistoryCourseLandingGameCopy;
  patchStage: PatchStageGameCopy;
  thisOrThat: ThisOrThatGameCopy;
}

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

export async function getPatchStageGameCopy(
  gameLocale: GameLocale,
): Promise<PatchStageGameCopy> {
  return getBorrowedGameCopy(gameLocale).patchStage;
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

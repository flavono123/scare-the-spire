import engGameOver from "../../data/sts2/eng/game_over_screen.json";
import korGameOver from "../../data/sts2/kor/game_over_screen.json";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";

type GameOverTable = Record<string, string>;

const GAME_OVER_BY_LOCALE: Partial<Record<GameLocale, GameOverTable>> = {
  eng: engGameOver as GameOverTable,
  kor: korGameOver as GameOverTable,
};

/** Architect false-victory ribbon (`BANNER.falseWin`) — e.g. kor "승리...?" */
const FALLBACK_FALSE_WIN: Record<"eng" | "kor", string> = {
  eng: "Victory...?",
  kor: "승리...?",
};

/** Map service UI locale to the game locale table we bake for history course. */
export function gameLocaleForServiceLocale(serviceLocale: ServiceLocale): GameLocale {
  return serviceLocale === "ko" ? "kor" : "eng";
}

/** In-game false-win banner after dying to the Architect (`BANNER.falseWin`). */
export function gameOverFalseWinLabel(gameLocale: GameLocale): string {
  const table = GAME_OVER_BY_LOCALE[gameLocale] ?? GAME_OVER_BY_LOCALE.eng;
  const key = gameLocale === "kor" ? "kor" : "eng";
  return table?.["BANNER.falseWin"] ?? FALLBACK_FALSE_WIN[key];
}

const LOSE_BANNER_KEYS = [
  "BANNER.lose0",
  "BANNER.lose1",
  "BANNER.lose2",
  "BANNER.lose3",
  "BANNER.lose4",
  "BANNER.lose5",
  "BANNER.lose6",
  "BANNER.lose7",
] as const;

function gameOverTable(gameLocale: GameLocale): GameOverTable | undefined {
  return GAME_OVER_BY_LOCALE[gameLocale] ?? GAME_OVER_BY_LOCALE.eng;
}

/** In-game defeat ribbon (`BANNER.lose0`–`lose7`). */
export function gameOverLoseBanner(gameLocale: GameLocale, salt = 0): string {
  const table = gameOverTable(gameLocale);
  const key = LOSE_BANNER_KEYS[Math.abs(salt) % LOSE_BANNER_KEYS.length];
  return table?.[key] ?? table?.["BANNER.lose1"] ?? "Defeat";
}

/** In-game death quote (`QUOTES.00`–`QUOTES.16`). */
export function gameOverQuote(gameLocale: GameLocale, salt = 0): string {
  const table = gameOverTable(gameLocale);
  const index = String(Math.abs(salt) % 17).padStart(2, "0");
  return table?.[`QUOTES.${index}`] ?? "";
}

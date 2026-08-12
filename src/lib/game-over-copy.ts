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

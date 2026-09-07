import { GAME_LOCALES, type GameLocale } from "@/lib/i18n";
import { STS1_GAME_LOCALES, type Sts1GameLocale } from "./types";

const STS1_LOCALE_SET = new Set<string>(STS1_GAME_LOCALES);

export function sts1GameLocale(gameLocale: GameLocale): Sts1GameLocale {
  if (gameLocale === "esp") return "spa";
  if (STS1_LOCALE_SET.has(gameLocale)) return gameLocale as Sts1GameLocale;
  return "eng";
}

export function isSts1GameLocale(value: string): value is Sts1GameLocale {
  return STS1_LOCALE_SET.has(value);
}

export function sts1PickerLocales(): GameLocale[] {
  return GAME_LOCALES.filter((locale) => locale !== "esp");
}

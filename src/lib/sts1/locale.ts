import { GAME_LOCALES, type GameLocale } from "@/lib/i18n";
import { STS1_GAME_LOCALES, type Sts1GameLocale } from "./types";

const STS1_LOCALE_SET = new Set<string>(STS1_GAME_LOCALES);

/** Settings.lineBreakViaCharacter is true only for ZHS, ZHT, and JPN. KOR is false. */
const LINE_BREAK_VIA_CHARACTER = new Set<Sts1GameLocale>(["zhs", "jpn"]);

const HTML_LANG: Record<Sts1GameLocale, string> = {
  kor: "ko",
  eng: "en",
  zhs: "zh-Hans",
  jpn: "ja",
  deu: "de",
  fra: "fr",
  ita: "it",
  spa: "es",
  ptb: "pt-BR",
  rus: "ru",
  pol: "pl",
  tha: "th",
  tur: "tr",
};

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

export function sts1LineBreakViaCharacter(gameLocale: GameLocale): boolean {
  return LINE_BREAK_VIA_CHARACTER.has(sts1GameLocale(gameLocale));
}

export function sts1HtmlLang(gameLocale: GameLocale): string {
  return HTML_LANG[sts1GameLocale(gameLocale)];
}

import korGameplayUi from "../../data/sts2/localization/kor/gameplay_ui.json";
import engGameplayUi from "../../data/sts2/localization/eng/gameplay_ui.json";
import korMerchantRoom from "../../data/sts2/localization/kor/merchant_room.json";
import engMerchantRoom from "../../data/sts2/localization/eng/merchant_room.json";
import { bakeDescription } from "@/lib/codex-bake";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { HistoryLocTables } from "@/lib/history-loc-tables";

type LocTable = Record<string, string>;

const GAMEPLAY_UI: Record<"kor" | "eng", LocTable> = {
  kor: korGameplayUi as LocTable,
  eng: engGameplayUi as LocTable,
};

function catalogLocale(locale: GameLocale | ServiceLocale): "kor" | "eng" {
  return locale === "eng" || locale === "en" ? "eng" : "kor";
}

export function gameplayUiText(
  locale: GameLocale | ServiceLocale,
  key: string,
  fallback: string,
  locTables?: HistoryLocTables | null,
): string {
  const fromCatalog = locTables?.gameplayUi?.[key];
  if (fromCatalog) return fromCatalog;
  const table = GAMEPLAY_UI[catalogLocale(locale)];
  return table[key] ?? GAMEPLAY_UI.eng[key] ?? fallback;
}

export function gameplayUiTemplate(
  locale: GameLocale | ServiceLocale,
  key: string,
  fallback: string,
  vars: Record<string, string | number>,
  locTables?: HistoryLocTables | null,
): string {
  return bakeDescription(gameplayUiText(locale, key, fallback, locTables), vars);
}

const MERCHANT_ROOM: Record<"kor" | "eng", LocTable> = {
  kor: korMerchantRoom as LocTable,
  eng: engMerchantRoom as LocTable,
};

/** A `merchant_room` line (MERCHANT.*) in the game locale, with its variables filled. */
export function merchantRoomTemplate(
  locale: GameLocale | ServiceLocale,
  key: string,
  fallback: string,
  vars: Record<string, string | number>,
  locTables?: HistoryLocTables | null,
): string {
  const template =
    locTables?.merchantRoom?.[key] ?? MERCHANT_ROOM[catalogLocale(locale)][key] ?? MERCHANT_ROOM.eng[key] ?? fallback;
  return bakeDescription(template, vars);
}

import korRunHistory from "../../data/sts2/localization/kor/run_history.json";
import engRunHistory from "../../data/sts2/localization/eng/run_history.json";
import zhsRunHistory from "../../data/sts2/localization/zhs/run_history.json";
import jpnRunHistory from "../../data/sts2/localization/jpn/run_history.json";
import deuRunHistory from "../../data/sts2/localization/deu/run_history.json";
import fraRunHistory from "../../data/sts2/localization/fra/run_history.json";
import itaRunHistory from "../../data/sts2/localization/ita/run_history.json";
import spaRunHistory from "../../data/sts2/localization/spa/run_history.json";
import espRunHistory from "../../data/sts2/localization/esp/run_history.json";
import ptbRunHistory from "../../data/sts2/localization/ptb/run_history.json";
import rusRunHistory from "../../data/sts2/localization/rus/run_history.json";
import polRunHistory from "../../data/sts2/localization/pol/run_history.json";
import thaRunHistory from "../../data/sts2/localization/tha/run_history.json";
import turRunHistory from "../../data/sts2/localization/tur/run_history.json";
import type { GameLocale } from "@/lib/i18n";

type LocTable = Record<string, string>;

const RUN_HISTORY: Record<GameLocale, LocTable> = {
  kor: korRunHistory,
  eng: engRunHistory,
  zhs: zhsRunHistory,
  jpn: jpnRunHistory,
  deu: deuRunHistory,
  fra: fraRunHistory,
  ita: itaRunHistory,
  spa: spaRunHistory,
  esp: espRunHistory,
  ptb: ptbRunHistory,
  rus: rusRunHistory,
  pol: polRunHistory,
  tha: thaRunHistory,
  tur: turRunHistory,
};

// Exact `relics.json` `FUR_COAT.historyEntry` — not inlined flavor.
const FUR_COAT_HISTORY_ENTRY: Record<GameLocale, string> = {
  kor: "적들에게 {Title}가 적용되었습니다.",
  eng: "Enemies were affected by {Title}.",
  zhs: "敌人们受到了{Title}的影响。",
  jpn: "敵は{Title}の影響を受けている。",
  deu: "Gegner waren von {Title} betroffen.",
  fra: "Les ennemis ont été affectés par le {Title}.",
  ita: "I nemici sono stati danneggiati dalla {Title}.",
  spa: "{Title} afectó a los enemigos.",
  esp: "{Title} afectó a los enemigos.",
  ptb: "Inimigos foram afetados por {Title}.",
  rus: "{Title} повлияла на этих врагов.",
  pol: "Przeciwnicy zostali osłabieni przez {Title}.",
  tha: "ศัตรูทั้งหมดได้รับผลจาก{Title}",
  tur: "Düşmanlar {Title} ile etkilendi.",
};

export function runHistoryText(
  locale: GameLocale,
  key: string,
  fallback: string,
): string {
  return RUN_HISTORY[locale]?.[key] ?? RUN_HISTORY.eng[key] ?? fallback;
}

/** `relics.FUR_COAT.historyEntry` — used on combat floors the coat marked. */
export function furCoatHistoryEntryText(locale: GameLocale): string {
  return FUR_COAT_HISTORY_ENTRY[locale] ?? FUR_COAT_HISTORY_ENTRY.eng;
}

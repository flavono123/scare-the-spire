import type { GameLocale } from "./i18n";

const STORY_COMPOSER_PLACEHOLDER_KEY = "OROBAS.talk.REGENT.1-0r.ancient";
const STORY_COMPOSER_PLACEHOLDER_FALLBACK = "Now tell more story!!";
type AncientLocalization = Partial<Record<string, string>>;

const ancientLocalizationLoaders: Record<GameLocale, () => Promise<AncientLocalization>> = {
  deu: () => import("../../data/sts2/localization/deu/ancients.json").then((module) => module.default),
  eng: () => import("../../data/sts2/localization/eng/ancients.json").then((module) => module.default),
  esp: () => import("../../data/sts2/localization/esp/ancients.json").then((module) => module.default),
  fra: () => import("../../data/sts2/localization/fra/ancients.json").then((module) => module.default),
  ita: () => import("../../data/sts2/localization/ita/ancients.json").then((module) => module.default),
  jpn: () => import("../../data/sts2/localization/jpn/ancients.json").then((module) => module.default),
  kor: () => import("../../data/sts2/localization/kor/ancients.json").then((module) => module.default),
  pol: () => import("../../data/sts2/localization/pol/ancients.json").then((module) => module.default),
  ptb: () => import("../../data/sts2/localization/ptb/ancients.json").then((module) => module.default),
  rus: () => import("../../data/sts2/localization/rus/ancients.json").then((module) => module.default),
  spa: () => import("../../data/sts2/localization/spa/ancients.json").then((module) => module.default),
  tha: () => import("../../data/sts2/localization/tha/ancients.json").then((module) => module.default),
  tur: () => import("../../data/sts2/localization/tur/ancients.json").then((module) => module.default),
  zhs: () => import("../../data/sts2/localization/zhs/ancients.json").then((module) => module.default),
};

function lastNonEmptyLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) ?? text.trim();
}

async function loadAncientLocalization(gameLocale: GameLocale) {
  return ancientLocalizationLoaders[gameLocale]();
}

export async function getStoryComposerPlaceholder(gameLocale: GameLocale) {
  const table = await loadAncientLocalization(gameLocale);
  const localized = table[STORY_COMPOSER_PLACEHOLDER_KEY];
  if (localized) return lastNonEmptyLine(localized);

  const fallbackTable = await loadAncientLocalization(gameLocale === "kor" ? "kor" : "eng");
  return lastNonEmptyLine(fallbackTable[STORY_COMPOSER_PLACEHOLDER_KEY] ?? STORY_COMPOSER_PLACEHOLDER_FALLBACK);
}

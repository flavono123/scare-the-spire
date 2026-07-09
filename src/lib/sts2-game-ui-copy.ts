import type { GameLocale } from "./i18n";
import { readGameLocalizationTable } from "./game-localization";

const STORY_COMPOSER_PLACEHOLDER_KEY = "OROBAS.talk.REGENT.1-0r.ancient";
const STORY_COMPOSER_PLACEHOLDER_FALLBACK = "Now tell more story!!";

function lastNonEmptyLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) ?? text.trim();
}

async function loadAncientLocalization(gameLocale: GameLocale) {
  return readGameLocalizationTable(gameLocale, "ancients");
}

export async function getStoryComposerPlaceholder(gameLocale: GameLocale) {
  const table = await loadAncientLocalization(gameLocale);
  const localized = table[STORY_COMPOSER_PLACEHOLDER_KEY];
  if (localized) return lastNonEmptyLine(localized);

  const fallbackTable = await loadAncientLocalization(gameLocale === "kor" ? "kor" : "eng");
  return lastNonEmptyLine(fallbackTable[STORY_COMPOSER_PLACEHOLDER_KEY] ?? STORY_COMPOSER_PLACEHOLDER_FALLBACK);
}

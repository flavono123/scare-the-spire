import type { CoverElement } from "@/lib/run-cover-types";
import {
  characterSpireClass,
  coverCardArtSrc,
  coverCharacterPortraitSrc,
  coverCharacterSelectSrc,
  coverElementImageSrc,
} from "@/lib/run-cover-suggest";
import { localize, prettifyId } from "@/lib/sts2-i18n";
import {
  isMadScienceCardId,
  MAD_SCIENCE_CARD_ID,
  MAD_SCIENCE_CARD_ID_BY_TYPE,
  getMadScienceVariantPartsFromId,
} from "@/lib/tinker-time";

export {
  characterSpireClass,
  coverCardArtSrc,
  coverCharacterPortraitSrc,
  coverCharacterSelectSrc,
  coverElementImageSrc,
};

/** Catalog / art id for cover tiles (Mad Science rider variants → type card). */
export function resolveCoverCardId(cardId: string): string {
  const parts = getMadScienceVariantPartsFromId(cardId);
  if (!parts) return cardId;
  return MAD_SCIENCE_CARD_ID_BY_TYPE[parts.cardType];
}

export function displayNameForCoverElement(element: CoverElement): string {
  if (element.kind === "card" && isMadScienceCardId(element.id)) {
    return localize("cards", MAD_SCIENCE_CARD_ID) ?? "괴짜 과학";
  }
  const table =
    element.kind === "card"
      ? "cards"
      : element.kind === "relic"
        ? "relics"
        : "potions";
  return localize(table, element.id) ?? prettifyId(element.id);
}

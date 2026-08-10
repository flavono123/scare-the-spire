import type { CoverElement } from "@/lib/run-cover-types";
import {
  characterSpireClass,
  coverCardArtSrc,
  coverCharacterPortraitSrc,
  coverCharacterSelectSrc,
  coverElementImageSrc,
} from "@/lib/run-cover-suggest";
import { localize, prettifyId } from "@/lib/sts2-i18n";

export {
  characterSpireClass,
  coverCardArtSrc,
  coverCharacterPortraitSrc,
  coverCharacterSelectSrc,
  coverElementImageSrc,
};

export function displayNameForCoverElement(element: CoverElement): string {
  const table =
    element.kind === "card"
      ? "cards"
      : element.kind === "relic"
        ? "relics"
        : "potions";
  return localize(table, element.id) ?? prettifyId(element.id);
}

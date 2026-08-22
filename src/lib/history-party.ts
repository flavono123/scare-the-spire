import korRestSiteUi from "../../data/sts2/localization/kor/rest_site_ui.json";
import engRestSiteUi from "../../data/sts2/localization/eng/rest_site_ui.json";
import type { GameLocale } from "@/lib/i18n";
import type {
  ReplayActAnalysis,
  ReplayBadge,
  ReplayBadgeRarity,
  ReplayRun,
} from "@/lib/sts2-run-replay";
import {
  cardWasInDeckAtFloor,
  furCoatMarkerNodeIdsForPlayer,
  playerHasRelic,
} from "@/lib/sts2-run-replay";

const RARITY_RANK: Record<ReplayBadgeRarity, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
};

const KNOWN_CHARACTERS = new Set([
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
]);

export function characterSlug(character: string | undefined): string {
  const slug = (character ?? "").replace(/^CHARACTER\./, "").toLowerCase();
  return KNOWN_CHARACTERS.has(slug) ? slug : "ironclad";
}

export function characterIconSrc(character: string | undefined): string {
  return `/images/sts2/characters/character_icon_${characterSlug(character)}.webp`;
}

export function characterIconOutlineSrc(character: string | undefined): string {
  return `/images/sts2/characters/character_icon_${characterSlug(character)}_outline.webp`;
}

export function characterMapMarkerSrc(character: string | undefined): string {
  return `/images/sts2/map/markers/map_marker_${characterSlug(character)}.png`;
}
export const PARTY_COVER_BADGE_MAX = 4;

/**
 * Unfocused run-history portraits are not Gaussian-blurred.
 * NRunHistoryPlayerIcon.Select/Deselect drives shaders/hsv.gdshader:
 * selected s=1 v=1 scale=1.1; deselected s=0.3 v=0.55 scale=0.95; tween 0.05s.
 */
export const RUN_HISTORY_ICON_SELECTED = {
  saturate: 1,
  brightness: 1,
  scale: 1.1,
  durationSec: 0.05,
} as const;

export const RUN_HISTORY_ICON_DESELECTED = {
  saturate: 0.3,
  brightness: 0.55,
  scale: 0.95,
  durationSec: 0.05,
} as const;

export function isMultiplayerRun(run: ReplayRun): boolean {
  return run.players.length > 1;
}

export function partyCharacters(run: ReplayRun): string[] {
  return run.players.map((player) => player.character);
}

export function clampPlayerIndex(run: ReplayRun, playerIndex: number): number {
  if (run.players.length === 0) return 0;
  return Math.max(0, Math.min(playerIndex, run.players.length - 1));
}

/**
 * Among duplicate characters, 1-based ordinal for that character only.
 * Unique characters return null (no extra mark).
 */
export function partyDuplicateOrdinals(characters: readonly string[]): Array<number | null> {
  const counts = new Map<string, number>();
  for (const character of characters) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return characters.map((character) => {
    if ((counts.get(character) ?? 0) < 2) return null;
    const next = (seen.get(character) ?? 0) + 1;
    seen.set(character, next);
    return next;
  });
}

const BADGE_ID = (id: string) => id.replace(/^[A-Z]+\./, "").toUpperCase();

/** Union party badges; same id keeps the highest rarity. */
export function mergePartyBadges(run: ReplayRun): ReplayBadge[] {
  const best = new Map<string, ReplayBadge>();
  for (const player of run.players) {
    for (const badge of player.badges) {
      const key = BADGE_ID(badge.id);
      const current = best.get(key);
      if (!current || RARITY_RANK[badge.rarity] > RARITY_RANK[current.rarity]) {
        best.set(key, badge);
      }
    }
  }
  return Array.from(best.values());
}

export function restSiteChoiceLabel(choice: string, locale: GameLocale): string {
  const option = choice.toUpperCase().replace(/^OPTION_/, "");
  const key = `OPTION_${option}.name`;
  const table = locale === "kor" ? korRestSiteUi : engRestSiteUi;
  const hit = (table as Record<string, string>)[key];
  if (hit) return hit;
  const fallback = (engRestSiteUi as Record<string, string>)[key];
  return fallback ?? option;
}

/** Shared path stays; quest / boots overlays follow the focused character. */
export function focusedMapAct(
  act: ReplayActAnalysis,
  run: ReplayRun,
  playerIndex: number,
): ReplayActAnalysis {
  const index = clampPlayerIndex(run, playerIndex);
  return {
    ...act,
    furCoatMarkerNodeIds: furCoatMarkerNodeIdsForPlayer(
      run,
      act.actIndex,
      act.nodes,
      index,
    ),
    spoilsMarkerNodeId:
      act.spoilsMarkerNodeId &&
      cardWasInDeckAtFloor(run, "SPOILS_MAP", act.baseFloor, index)
        ? act.spoilsMarkerNodeId
        : null,
    flightArrivalNodeIds: playerHasRelic(run, index, "WINGED_BOOTS")
      ? act.flightArrivalNodeIds
      : [],
  };
}

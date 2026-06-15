import type { ServiceLocale } from "@/lib/i18n";
import type { ReplayRun } from "@/lib/sts2-run-replay";
import { localize, prettifyId } from "@/lib/sts2-i18n";

type HighlightKind = "card" | "relic";

export interface RunHighlightResource {
  kind: HighlightKind;
  id: string;
  nameKo: string;
  nameEn: string;
  imageUrl: string | null;
}

export interface RunHighlights {
  card: RunHighlightResource | null;
  relic: RunHighlightResource | null;
}

export function buildRunHighlights(run: ReplayRun, runId: string): RunHighlights {
  const player = run.players[0];
  if (!player) return { card: null, relic: null };

  const finalCards = player.deck.filter((card) => typeof card.id === "string");
  const acquiredCards = finalCards.filter((card) => (card.floor_added_to_deck ?? 1) > 1);
  const cardPool = acquiredCards.length > 0 ? acquiredCards : finalCards;

  const finalRelics = player.relics.filter((relic) => typeof relic.id === "string");
  const acquiredRelics = finalRelics.filter((relic) => (relic.floor_added_to_deck ?? 0) > 0);
  const relicPool = acquiredRelics.length > 0 ? acquiredRelics : finalRelics;

  const card = pickStable(cardPool, `${runId}:${run.seed}:card`);
  const relic = pickStable(relicPool, `${runId}:${run.seed}:relic`);

  return {
    card: card ? toHighlight("card", card.id) : null,
    relic: relic ? toHighlight("relic", relic.id) : null,
  };
}

export function runHighlightName(
  highlight: RunHighlightResource,
  serviceLocale: ServiceLocale,
): string {
  return serviceLocale === "ko" ? highlight.nameKo : highlight.nameEn;
}

function toHighlight(kind: HighlightKind, replayId: string): RunHighlightResource {
  const id = normalizeId(replayId);
  const table = kind === "card" ? "cards" : "relics";
  return {
    kind,
    id,
    nameKo: localize(table, id) ?? prettifyId(id),
    nameEn: prettifyId(id),
    imageUrl: `/images/sts2/${kind === "card" ? "cards" : "relics"}/${id.toLowerCase()}.webp`,
  };
}

function normalizeId(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

function pickStable<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null;
  return items[hashString(seed) % items.length] ?? null;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

import type { LinkedEntity, Story } from "@/lib/types";

export const ELEMENT_ART_PATH = "/generated/element-art.json";
export const STORY_FALLBACK_ART = "/images/sts2/nav/patch_notes_icon.png";

type ElementRef = Pick<LinkedEntity, "entityType" | "entityId"> & { game?: string };

// Legacy STS1 stories point at the old /images/{cards,relics,potions} art.
const STS1_LEGACY_FOLDERS: Record<string, string> = { card: "cards", relic: "relics", potion: "potions" };

function elementArt(ref: ElementRef, storyGame: string | undefined, art: Record<string, string>): string | null {
  const game = ref.game ?? storyGame;
  if (game === "sts2") return art[`${ref.entityType}:${ref.entityId}`] ?? null;
  const folder = STS1_LEGACY_FOLDERS[ref.entityType];
  return folder ? `/images/${folder}/${ref.entityId}.webp` : null;
}

/** The story's own element, then its first linked element, then the patch notes icon. */
export function storyArtUrl(
  story: Pick<Story, "game" | "entityType" | "entityId" | "linkedEntities">,
  art: Record<string, string>,
): { url: string; fallback: boolean } {
  const refs: ElementRef[] = [
    ...(story.entityType && story.entityId ? [{ entityType: story.entityType, entityId: story.entityId }] : []),
    ...(story.linkedEntities ?? []),
  ];
  for (const ref of refs) {
    const url = elementArt(ref, story.game, art);
    if (url) return { url, fallback: false };
  }
  return { url: STORY_FALLBACK_ART, fallback: true };
}

import type { ServiceLocale } from "@/lib/i18n";
import type { STS2Patch } from "@/lib/types";
import { GAMBIT_PATCH_HERO, GAMBIT_TITLE_TOKEN } from "@/lib/gambit-patch-shell";
import { WITHER_PATCH_HERO, WITHER_TITLE_TOKEN } from "@/lib/wither-patch-shell";

export type ShellPatchType = "wither" | "gambit";

/**
 * A shell patch has no Steam notes. It borrows a card line as its hero and
 * shows the community reels in place of the patch body.
 */
export interface PatchShell {
  titleToken: { src: string; alt: Record<ServiceLocale, string> };
  titleTokenClassName: string;
  hero: Record<ServiceLocale, string>;
  searchImageUrl: string;
  /** Put the debate reel above the transfigure reel. */
  debateFirst: boolean;
  /** A 슬서운이야기 channel playlist embedded under the transfigure reel. */
  youtubePlaylist?: { id: string; title: string };
}

const PATCH_SHELLS: Record<ShellPatchType, PatchShell> = {
  wither: {
    titleToken: WITHER_TITLE_TOKEN,
    titleTokenClassName: "grayscale",
    hero: WITHER_PATCH_HERO,
    searchImageUrl: "/images/sts2/cards/wither1.webp",
    debateFirst: false,
  },
  gambit: {
    titleToken: GAMBIT_TITLE_TOKEN,
    titleTokenClassName: "",
    hero: GAMBIT_PATCH_HERO,
    searchImageUrl: "/images/sts2/cards/the_gambit.webp",
    debateFirst: true,
    youtubePlaylist: { id: "PLSyF4zC6ClQw", title: "패치노트" },
  },
};

export function getPatchShell(patch: STS2Patch): PatchShell | null {
  if (patch.type === "wither" || patch.type === "gambit") return PATCH_SHELLS[patch.type];
  return null;
}

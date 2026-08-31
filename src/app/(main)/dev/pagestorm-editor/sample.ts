import { parseYouTubeVideoId, youtubeThumbnailUrl } from "@/lib/youtube-reference";

export type MockAlign = "left" | "center" | "right";

export type MockAssetKind = "card" | "relic" | "power";

export type MockGameAsset = {
  id: string;
  kind: MockAssetKind;
  name: string;
  imageUrl: string;
  href: string;
};

export type MockOgBookmark = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
};

export const SAMPLE_ASSETS: readonly MockGameAsset[] = [
  {
    id: "CHEMICAL_X",
    kind: "relic",
    name: "케미컬 X",
    imageUrl: "/images/sts2/relics/chemical_x.webp",
    href: "/compendium/relics/chemical_x",
  },
  {
    id: "STARDUST",
    kind: "card",
    name: "우주 먼지",
    imageUrl: "/images/sts2/cards/stardust.webp",
    href: "/compendium/cards/stardust",
  },
  {
    id: "HEAVENLY_DRILL",
    kind: "card",
    name: "천원돌파",
    imageUrl: "/images/sts2/cards/heavenly_drill.webp",
    href: "/compendium/cards/heavenly_drill",
  },
  {
    id: "FALLING_STAR",
    kind: "card",
    name: "별똥별",
    imageUrl: "/images/sts2/cards/falling_star.webp",
    href: "/compendium/cards/falling_star",
  },
  {
    id: "PAGESTORM",
    kind: "card",
    name: "서류 폭풍",
    imageUrl: "/images/sts2/cards/pagestorm.webp",
    href: "/compendium/cards/pagestorm",
  },
  {
    id: "INK_BOTTLE",
    kind: "relic",
    name: "잉크병",
    imageUrl: "/images/sts2/relics/ink_bottle.webp",
    href: "/compendium/relics/ink_bottle",
  },
  {
    id: "PAGESTORM_POWER",
    kind: "power",
    name: "서류 폭풍",
    imageUrl: "/images/sts2/powers/pagestorm_power.webp",
    href: "/compendium/powers/pagestorm",
  },
] as const;

export const SAMPLE_YOUTUBE = {
  videoId: "uC_k4W41Gg4",
  title: "리젠트 종합 공략 / 슬레이 더 스파이어 2",
} as const;

const CANNED_BOOKMARKS: readonly MockOgBookmark[] = [
  {
    url: "https://store.steampowered.com/app/2868840/Slay_the_Spire_2/",
    title: "Slay the Spire 2 on Steam",
    description: "The sequel to the world's most popular deckbuilder.",
    image: "/images/sts2/cards/pagestorm.webp",
    siteName: "Steam · mock OG snapshot",
  },
  {
    url: "https://www.youtube.com/watch?v=uC_k4W41Gg4",
    title: SAMPLE_YOUTUBE.title,
    description: "최점모 리젠트 종합 공략. 서류 작성기 목에서는 플레이어로 넣는다.",
    image: youtubeThumbnailUrl(SAMPLE_YOUTUBE.videoId),
    siteName: "YouTube",
  },
];

export function findSampleAsset(id: string): MockGameAsset | undefined {
  return SAMPLE_ASSETS.find((asset) => asset.id === id);
}

export function resolvePastedUrl(raw: string):
  | { kind: "youtube"; videoId: string; title: string }
  | { kind: "og"; bookmark: MockOgBookmark }
  | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const videoId = parseYouTubeVideoId(trimmed);
  if (videoId) {
    const canned = CANNED_BOOKMARKS.find((item) => parseYouTubeVideoId(item.url) === videoId);
    return {
      kind: "youtube",
      videoId,
      title: canned?.title ?? "YouTube",
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const canned = CANNED_BOOKMARKS.find((item) => item.url === url.href);
  if (canned) return { kind: "og", bookmark: canned };

  return {
    kind: "og",
    bookmark: {
      url: url.href,
      title: url.hostname.replace(/^www\./, ""),
      description: "작성 시점 OG 스냅샷 (이 목은 네트워크 요청 없이 hostname만 저장한다).",
      image: null,
      siteName: url.hostname,
    },
  };
}

export const SAMPLE_URL_PLACEHOLDER =
  "유튜브 또는 https://store.steampowered.com/app/2868840/Slay_the_Spire_2/";

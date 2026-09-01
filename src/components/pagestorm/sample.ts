import type { JSONContent } from "@tiptap/core";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { parseYouTubeVideoId, youtubeThumbnailUrl } from "@/lib/youtube-reference";

export type MockAlign = "left" | "center" | "right";

export type MockAssetKind = string;

export type CardPresentation = "art" | "tile" | "tiny";

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

export function assetFromEntity(entity: EntityInfo): MockGameAsset {
  return {
    id: entity.id,
    kind: entity.type,
    name: entity.nameKo,
    imageUrl: entity.imageUrl ?? "",
    href: entity.href ?? "#",
  };
}

export function defaultAssetWidth(kind: MockAssetKind): number {
  return kind === "card" ? 128 : 64;
}

export function clampAssetWidth(kind: MockAssetKind, width: number): number {
  if (kind === "card") return Math.min(240, Math.max(72, Math.round(width)));
  return Math.min(128, Math.max(40, Math.round(width)));
}

export function clampAssetHeight(kind: MockAssetKind, height: number): number {
  if (kind === "card") return Math.min(400, Math.max(64, Math.round(height)));
  return clampAssetWidth(kind, height);
}

export function defaultPlayerWidth(): number {
  return 576;
}

export function clampPlayerWidth(width: number): number {
  return Math.min(720, Math.max(240, Math.round(width)));
}

export function filterPrefixItems(query: string): MockGameAsset[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...SAMPLE_ASSETS];
  return SAMPLE_ASSETS.filter((asset) => {
    return asset.name.toLowerCase().includes(needle) || asset.id.toLowerCase().includes(needle);
  });
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
      description: "",
      image: null,
      siteName: url.hostname,
    },
  };
}

export const SAMPLE_URL_PLACEHOLDER =
  "유튜브 또는 https://store.steampowered.com/app/2868840/Slay_the_Spire_2/";

const LOREM_P1 =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
const LOREM_P2 =
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
const LOREM_LIGHT =
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.";

function sampleAssetNode(id: string, align: MockAlign = "center"): JSONContent {
  const asset = findSampleAsset(id);
  if (!asset) {
    return { type: "paragraph" };
  }
  const width = defaultAssetWidth(asset.kind);
  return {
    type: "gameAsset",
    attrs: {
      assetId: asset.id,
      kind: asset.kind,
      entityType: asset.kind,
      name: asset.name,
      imageUrl: asset.imageUrl,
      href: asset.href,
      align,
      linked: true,
      width,
      height: asset.kind === "card" ? Math.round(width * 1.56) : width,
      presentation: "art",
      beta: false,
    },
  };
}

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

export function pagestormLoremDoc(copy: {
  sampleHeading: string;
  sampleLightHeading: string;
  sampleLightHint: string;
}): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, textAlign: "left" },
        content: [text(copy.sampleHeading)],
      },
      {
        type: "paragraph",
        content: [
          text("Lorem ipsum dolor sit amet, "),
          text("consectetur", [{ type: "bold" }]),
          text(" adipiscing elit. "),
          text("Ut enim ad minim", [
            { type: "pagestormColor", attrs: { colorKey: "spire-gold" } },
          ]),
          text(" veniam, quis nostrud "),
          text("exercitation", [{ type: "sine" }]),
          text(" ullamco."),
        ],
      },
      {
        type: "paragraph",
        content: [text(LOREM_P1)],
      },
      sampleAssetNode("CHEMICAL_X", "center"),
      {
        type: "paragraph",
        attrs: { textAlign: "right" },
        content: [text(LOREM_P2)],
      },
      sampleAssetNode("STARDUST", "right"),
      {
        type: "pagestormLightSection",
        content: [
          {
            type: "heading",
            attrs: { level: 3 },
            content: [text(copy.sampleLightHeading)],
          },
          {
            type: "paragraph",
            content: [text(copy.sampleLightHint)],
          },
          {
            type: "paragraph",
            content: [
              text(LOREM_LIGHT.slice(0, 48)),
              text(" magna aliqua", [
                { type: "pagestormColor", attrs: { colorKey: "spire-gold" } },
                { type: "sine" },
              ]),
              text(`. ${LOREM_LIGHT.slice(48)}`),
            ],
          },
          sampleAssetNode("PAGESTORM", "left"),
        ],
      },
      {
        type: "toyboxEmbed",
        attrs: {
          postId: "mock-dd-regent",
          service: "/decisions-decisions",
          align: "center",
          linked: true,
          width: 576,
          height: 280,
        },
      },
    ],
  };
}

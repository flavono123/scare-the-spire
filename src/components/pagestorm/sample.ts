import type { JSONContent } from "@tiptap/core";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { COMBO_KEYWORD_IMAGE_URL } from "@/lib/combo-resource-visuals";
import {
  buildCompendiumResourceHref,
  isCompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";
import { ASCENSION_TOKEN_IMAGE_URL } from "@/lib/codex-types";
import { PAGESTORM_LOREM_SNIPPET } from "@/lib/pagestorm";
import { parseYouTubeVideoId, youtubeThumbnailUrl } from "@/lib/youtube-reference";
import type { ServiceMessages } from "@/messages/service";
import {
  PAGESTORM_CHARACTER_COLOR_KEYS,
  PAGESTORM_SPIRE_COLOR_KEYS,
} from "./color-marks";
import { PAGESTORM_TOYBOX_POSTS } from "./toybox-samples";

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

type PagestormCopy = ServiceMessages["pagestorm"];

function assetHref(kind: string, id: string): string {
  if (isCompendiumResourceLinkType(kind)) {
    return buildCompendiumResourceHref(kind, id);
  }
  return "#";
}

function asset(
  id: string,
  kind: MockAssetKind,
  name: string,
  imageUrl: string,
): MockGameAsset {
  return { id, kind, name, imageUrl, href: assetHref(kind, id) };
}

export const SAMPLE_ASSETS: readonly MockGameAsset[] = [
  asset("IRONCLAD", "character", "아이언클래드", "/images/sts2/characters/char_select_ironclad.webp"),
  asset("PAGESTORM", "card", "서류 폭풍", "/images/sts2/cards/pagestorm.webp"),
  asset("STARDUST", "card", "우주 먼지", "/images/sts2/cards/stardust.webp"),
  asset("HEAVENLY_DRILL", "card", "천원돌파", "/images/sts2/cards/heavenly_drill.webp"),
  asset("FALLING_STAR", "card", "별똥별", "/images/sts2/cards/falling_star.webp"),
  asset("CHEMICAL_X", "relic", "케미컬 X", "/images/sts2/relics/chemical_x.webp"),
  asset("INK_BOTTLE", "relic", "잉크병", "/images/sts2/relics/ink_bottle.webp"),
  asset("BLOOD_POTION", "potion", "피 포션", "/images/sts2/potions/blood_potion.webp"),
  asset("PAGESTORM", "power", "서류 폭풍", "/images/sts2/powers/pagestorm_power.webp"),
  asset("ADROIT", "enchantment", "숙련", "/images/sts2/enchantments/adroit.webp"),
  asset("AXEBOT", "monster", "잘라봇", "/images/sts2/monsters-render/axebot.webp"),
  asset("ABYSSAL_BATHS", "event", "심연의 욕탕", "/images/sts2/events/abyssal_baths.webp"),
  asset("DARV", "ancient", "다브", "/images/sts2/ancients/darv.webp"),
  asset("COLORLESS1_EPOCH", "epoch", "프리온", "/images/sts2/epochs/colorless1_epoch.webp"),
  asset("ETHEREAL", "keyword", "휘발성", COMBO_KEYWORD_IMAGE_URL),
  asset("CCCCOMBO", "badge", "코오오옴보", "/images/sts2/badges/ccccombo.webp"),
  asset("LEVEL_01", "ascension", "몰려드는 엘리트", ASCENSION_TOKEN_IMAGE_URL),
  asset("ALL_STAR", "modifier", "올스타", "/images/sts2/modifiers/all_star.webp"),
];

const LOREM_ASSET_KEYS: ReadonlyArray<readonly [string, MockAssetKind]> = [
  ["IRONCLAD", "character"],
  ["PAGESTORM", "card"],
  ["CHEMICAL_X", "relic"],
  ["BLOOD_POTION", "potion"],
  ["PAGESTORM", "power"],
  ["ADROIT", "enchantment"],
  ["AXEBOT", "monster"],
  ["ABYSSAL_BATHS", "event"],
  ["DARV", "ancient"],
  ["COLORLESS1_EPOCH", "epoch"],
  ["ETHEREAL", "keyword"],
  ["CCCCOMBO", "badge"],
  ["LEVEL_01", "ascension"],
  ["ALL_STAR", "modifier"],
];

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
    siteName: "Steam",
  },
  {
    url: "https://www.megacrit.com/news/2024-12-12-gameplay-trailer/",
    title: "Slay the Spire 2's First Gameplay Trailer is Here!",
    description: "The gameplay reveal for the sequel, as shown at The Game Awards.",
    image: youtubeThumbnailUrl("MqvQjQb_3sI"),
    siteName: "Mega Crit Games",
  },
  {
    url: "https://www.youtube.com/watch?v=uC_k4W41Gg4",
    title: SAMPLE_YOUTUBE.title,
    description: "최점모 리젠트 종합 공략.",
    image: youtubeThumbnailUrl(SAMPLE_YOUTUBE.videoId),
    siteName: "YouTube",
  },
];

const SAMPLE_OG_BOOKMARKS = CANNED_BOOKMARKS.filter(
  (item) => parseYouTubeVideoId(item.url) == null,
);

export function findSampleAsset(id: string, kind?: string): MockGameAsset | undefined {
  const needle = id.toLowerCase();
  return SAMPLE_ASSETS.find((item) => {
    if (item.id.toLowerCase() !== needle) return false;
    if (kind && item.kind !== kind) return false;
    return true;
  });
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
  return SAMPLE_ASSETS.filter((item) => {
    return item.name.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle);
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

const LOREM_P1 = PAGESTORM_LOREM_SNIPPET;
const LOREM_P2 =
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
const LOREM_LIGHT =
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.";

const ALIGNS: readonly MockAlign[] = ["left", "center", "right"];

function sampleAssetNode(id: string, kind: MockAssetKind, align: MockAlign = "center"): JSONContent {
  const found = findSampleAsset(id, kind);
  if (!found) {
    return { type: "paragraph" };
  }
  const width = defaultAssetWidth(found.kind);
  return {
    type: "gameAsset",
    attrs: {
      assetId: found.id,
      kind: found.kind,
      entityType: found.kind,
      name: found.name,
      imageUrl: found.imageUrl,
      href: found.href,
      align,
      linked: true,
      width,
      height: found.kind === "card" ? Math.round(width * 1.56) : width,
      presentation: "art",
      beta: false,
    },
  };
}

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function heading(level: 2 | 3, value: string): JSONContent {
  return {
    type: "heading",
    attrs: { level, textAlign: "left" },
    content: [text(value)],
  };
}

function paragraph(
  content: JSONContent[],
  align: MockAlign = "left",
): JSONContent {
  return {
    type: "paragraph",
    attrs: { textAlign: align },
    content,
  };
}

function styleComboNodes(copy: PagestormCopy): JSONContent[] {
  const colors: Array<{ key: string | null; label: string }> = [
    { key: null, label: copy.sampleColorNone },
    ...PAGESTORM_SPIRE_COLOR_KEYS.map((key) => ({
      key: `spire-${key}`,
      label: copy.spireColors[key],
    })),
    ...PAGESTORM_CHARACTER_COLOR_KEYS.map((key) => ({
      key: `character-${key}`,
      label: copy.characterColors[key],
    })),
  ];

  const nodes: JSONContent[] = [];
  for (const color of colors) {
    for (let mask = 0; mask < 16; mask += 1) {
      const bold = Boolean(mask & 1);
      const italic = Boolean(mask & 2);
      const sine = Boolean(mask & 4);
      const jitter = Boolean(mask & 8);
      const parts = [color.label];
      if (bold) parts.push(copy.bold);
      if (italic) parts.push(copy.italic);
      if (sine) parts.push(copy.sine);
      if (jitter) parts.push(copy.jitter);
      const marks: NonNullable<JSONContent["marks"]> = [];
      if (color.key) {
        marks.push({ type: "pagestormColor", attrs: { colorKey: color.key } });
      }
      if (bold) marks.push({ type: "bold" });
      if (italic) marks.push({ type: "italic" });
      if (sine) marks.push({ type: "sine" });
      if (jitter) marks.push({ type: "jitter" });
      nodes.push(paragraph([
        text(`${parts.join(" · ")} `),
        marks.length > 0 ? text(copy.sampleGlyph, marks) : text(copy.sampleGlyph),
      ]));
    }
  }
  return nodes;
}

function youtubeNode(): JSONContent {
  return {
    type: "youtubePlayer",
    attrs: {
      videoId: SAMPLE_YOUTUBE.videoId,
      title: SAMPLE_YOUTUBE.title,
      align: "center",
    },
  };
}

function ogNode(bookmark: MockOgBookmark): JSONContent {
  return {
    type: "ogBookmark",
    attrs: {
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      image: bookmark.image,
      siteName: bookmark.siteName,
      align: "center",
    },
  };
}

function toyboxNode(postId: string, service: string, height: number): JSONContent {
  return {
    type: "toyboxEmbed",
    attrs: {
      postId,
      service,
      align: "center",
      linked: true,
      width: 576,
      height,
    },
  };
}

export const PAGESTORM_EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function pagestormLoremDoc(copy: PagestormCopy): JSONContent {
  const loremAssets = LOREM_ASSET_KEYS.map(([id, kind], index) => (
    sampleAssetNode(id, kind, ALIGNS[index % ALIGNS.length])
  ));
  const toyboxNodes = PAGESTORM_TOYBOX_POSTS.map((post) => (
    toyboxNode(post.id, post.service, post.service === "/this-or-that" ? 320 : 280)
  ));

  return {
    type: "doc",
    content: [
      heading(2, copy.sampleHeading),
      paragraph([text(LOREM_P1)]),
      paragraph([text(LOREM_P2)], "right"),
      heading(2, copy.sampleStylesSection),
      ...styleComboNodes(copy),
      heading(2, copy.sampleBlocksSection),
      heading(3, copy.heading3),
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [paragraph([text(copy.bulletList)])],
          },
          {
            type: "listItem",
            content: [paragraph([text(LOREM_P2.slice(0, 42))])],
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          paragraph([text(copy.blockquote)]),
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [paragraph([text(copy.bulletList)])],
              },
            ],
          },
        ],
      },
      { type: "horizontalRule" },
      paragraph([text(copy.alignLeft)], "left"),
      paragraph([text(copy.alignCenter)], "center"),
      paragraph([text(copy.alignRight)], "right"),
      heading(2, copy.sampleAssetsSection),
      ...loremAssets,
      {
        type: "pagestormLightSection",
        content: [
          heading(3, copy.sampleLightHeading),
          paragraph([text(copy.sampleLightHint)]),
          paragraph([
            text(LOREM_LIGHT.slice(0, 48)),
            text(" magna aliqua", [
              { type: "pagestormColor", attrs: { colorKey: "spire-gold" } },
              { type: "sine" },
            ]),
            text(`. ${LOREM_LIGHT.slice(48)}`),
          ]),
          sampleAssetNode("PAGESTORM", "card", "left"),
        ],
      },
      heading(2, copy.sampleLinksSection),
      youtubeNode(),
      ...SAMPLE_OG_BOOKMARKS.map(ogNode),
      heading(2, copy.sampleToyboxSection),
      ...toyboxNodes,
    ],
  };
}

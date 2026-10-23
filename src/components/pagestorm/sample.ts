import type { JSONContent } from "@tiptap/core";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { COMBO_KEYWORD_IMAGE_URL } from "@/lib/combo-resource-visuals";
import {
  buildCompendiumResourceHref,
  isCompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";
import { ASCENSION_TOKEN_IMAGE_URL } from "@/lib/codex-types";
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

/** Extracted event art (`abyssal_baths.webp` 3440×1616) and epoch art (`colorless1_epoch.webp` 810×500). */
const LANDSCAPE_ART_ASPECT: Record<"event" | "epoch", number> = {
  event: 3440 / 1616,
  epoch: 810 / 500,
};

/** Width / height of extracted STS2 card art (`pagestorm.webp` 1000×760). */
export const CARD_ART_IMAGE_ASPECT = 1000 / 760;
/** Height / width of the in-game card tile frame. */
export const CARD_TILE_ASPECT = 422 / 300;
export const WIDE_ART_MAX_WIDTH = 1080;
export const WIDE_ART_MIN_WIDTH = 200;

export function isLandscapeArtKind(kind: MockAssetKind): kind is "event" | "epoch" {
  return kind === "event" || kind === "epoch";
}

function clampPx(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function landscapeArtAspect(kind: MockAssetKind): number {
  return isLandscapeArtKind(kind) ? LANDSCAPE_ART_ASPECT[kind] : 1;
}

export function cardArtAspect(imageAspect?: number): number {
  return imageAspect && imageAspect > 0 ? imageAspect : CARD_ART_IMAGE_ASPECT;
}

export function defaultAssetBox(
  kind: MockAssetKind,
  presentation: CardPresentation = "art",
  imageAspect?: number,
): { width: number; height: number } {
  if (kind === "card") {
    if (presentation === "tiny") return { width: 72, height: 72 };
    if (presentation === "tile") {
      const width = 150;
      return { width, height: Math.round(width * CARD_TILE_ASPECT) };
    }
    const width = WIDE_ART_MIN_WIDTH;
    return { width, height: Math.round(width / cardArtAspect(imageAspect)) };
  }
  if (isLandscapeArtKind(kind)) {
    const width = 720;
    return { width, height: Math.round(width / LANDSCAPE_ART_ASPECT[kind]) };
  }
  const width = 64;
  return { width, height: width };
}

export function defaultAssetWidth(
  kind: MockAssetKind,
  presentation: CardPresentation = "art",
): number {
  return defaultAssetBox(kind, presentation).width;
}

export function defaultAssetHeight(
  kind: MockAssetKind,
  presentation: CardPresentation = "art",
): number {
  return defaultAssetBox(kind, presentation).height;
}

export function clampAssetWidth(
  kind: MockAssetKind,
  width: number,
  presentation: CardPresentation = "art",
): number {
  if (kind === "card") {
    if (presentation === "tiny") return clampPx(width, 24, 96);
    if (presentation === "tile") return clampPx(width, 72, 380);
    return clampPx(width, WIDE_ART_MIN_WIDTH, WIDE_ART_MAX_WIDTH);
  }
  if (isLandscapeArtKind(kind)) return clampPx(width, WIDE_ART_MIN_WIDTH, WIDE_ART_MAX_WIDTH);
  return clampPx(width, 40, 128);
}

export function clampAssetHeight(
  kind: MockAssetKind,
  height: number,
  presentation: CardPresentation = "art",
  imageAspect?: number,
): number {
  if (kind === "card") {
    if (presentation === "tiny") return clampPx(height, 24, 96);
    if (presentation === "tile") return clampPx(height, 96, 534);
    const aspect = cardArtAspect(imageAspect);
    return clampPx(
      height,
      Math.round(WIDE_ART_MIN_WIDTH / aspect),
      Math.round(WIDE_ART_MAX_WIDTH / aspect),
    );
  }
  if (isLandscapeArtKind(kind)) {
    const aspect = LANDSCAPE_ART_ASPECT[kind];
    return clampPx(
      height,
      Math.round(WIDE_ART_MIN_WIDTH / aspect),
      Math.round(WIDE_ART_MAX_WIDTH / aspect),
    );
  }
  return clampAssetWidth(kind, height, presentation);
}

export function sizedAssetBox(
  kind: MockAssetKind,
  width: number,
  height: number,
  presentation: CardPresentation = "art",
  imageAspect?: number,
): { width: number; height: number } {
  const nextWidth = clampAssetWidth(kind, width, presentation);
  if (isLandscapeArtKind(kind)) {
    return {
      width: nextWidth,
      height: Math.round(nextWidth / LANDSCAPE_ART_ASPECT[kind]),
    };
  }
  if (kind === "card" && presentation === "art") {
    const aspect = cardArtAspect(imageAspect);
    return {
      width: nextWidth,
      height: Math.round(nextWidth / aspect),
    };
  }
  return {
    width: nextWidth,
    height: clampAssetHeight(kind, height, presentation, imageAspect),
  };
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

const LOREM_P1 =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
const LOREM_P2 =
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
const LOREM_LIGHT =
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.";

const ALIGNS: readonly MockAlign[] = ["left", "center", "right"];

function sampleAssetNode(
  id: string,
  kind: MockAssetKind,
  align: MockAlign = "center",
  linked = true,
): JSONContent {
  const found = findSampleAsset(id, kind);
  if (!found) {
    return { type: "paragraph" };
  }
  const box = defaultAssetBox(found.kind, "art");
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
      linked,
      width: box.width,
      height: box.height,
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
    type: "paragraph",
    content: [{
      type: "text",
      text: bookmark.title || bookmark.url,
      marks: [{
        type: "link",
        attrs: {
          href: bookmark.url,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "pagestorm-inline-link",
        },
      }],
    }],
  };
}

function toyboxNode(
  postId: string,
  service: string,
  height: number,
  linked = true,
): JSONContent {
  return {
    type: "toyboxEmbed",
    attrs: {
      postId,
      service,
      align: "center",
      linked,
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
    sampleAssetNode(
      id,
      kind,
      ALIGNS[index % ALIGNS.length],
      index < LOREM_ASSET_KEYS.length - 1,
    )
  ));
  const toyboxNodes = PAGESTORM_TOYBOX_POSTS.map((post, index) => (
    toyboxNode(
      post.id,
      post.service,
      post.service === "/this-or-that" ? 320 : 280,
      index < PAGESTORM_TOYBOX_POSTS.length - 1,
    )
  ));

  return {
    type: "doc",
    content: [
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

function mention(text: string, keyword: string, entityId: string, entityType: string): JSONContent {
  return {
    type: "pagestormMention",
    attrs: { text, keyword, description: "", entityId, entityType },
  };
}

function cell(type: "tableHeader" | "tableCell", value: string): JSONContent {
  return { type, content: [paragraph([text(value)])] };
}

/**
 * Every Pagestorm node and mark once, in a short document. The dev editor
 * page starts from it; pagestormLoremDoc above is the exhaustive style grid.
 */
export function pagestormFeatureSampleDoc(): JSONContent {
  const steam = CANNED_BOOKMARKS[0]!;
  return {
    type: "doc",
    content: [
      heading(2, "Lorem ipsum dolor"),
      paragraph([
        text("Lorem ipsum "),
        text("dolor", [{ type: "bold" }]),
        text(" sit "),
        text("amet", [{ type: "italic" }]),
        text(", "),
        text("consectetur", [{ type: "strike" }]),
        text(" "),
        text("adipiscing()", [{ type: "code" }]),
        text(" elit, "),
        text("sed do", [{ type: "pagestormColor", attrs: { colorKey: "spire-gold" } }, { type: "sine" }]),
        text(" "),
        text("eiusmod", [{ type: "pagestormColor", attrs: { colorKey: "spire-red" } }, { type: "jitter" }]),
        text(" "),
        text("tempor", [{ type: "pagestormColor", attrs: { colorKey: "character-silent" } }]),
        text("."),
      ]),
      paragraph([
        mention("강펀치", "강타", "BASH", "card"),
        text("로 "),
        mention("취약", "취약", "VULNERABLE", "power"),
        text("을 걸고 "),
        mention("강타", "강타", "sts1:cards:bash", "card"),
        text("(STS1)와 비교. 내부 링크 "),
        {
          type: "pagestormInternalLink",
          attrs: {
            href: "/byrdispatch",
            label: "섀소식",
            title: "섀소식",
            preview: "슬서운 이야기 업데이트 소식",
            ogImage: "",
            ogImageAlt: "",
          },
        },
        text(", 외부 링크 "),
        text(steam.title, [{
          type: "link",
          attrs: {
            href: steam.url,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "pagestorm-inline-link",
          },
        }]),
        text("."),
      ]),
      heading(3, "Ut enim ad minim"),
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              paragraph([text(LOREM_P2.slice(0, 40))]),
              {
                type: "bulletList",
                content: [{ type: "listItem", content: [paragraph([text("nisi ut aliquip")])] }],
              },
            ],
          },
          { type: "listItem", content: [paragraph([text("ex ea commodo consequat")])] },
        ],
      },
      {
        type: "orderedList",
        content: [
          { type: "listItem", content: [paragraph([text("Duis aute irure")])] },
          { type: "listItem", content: [paragraph([text("in reprehenderit")])] },
        ],
      },
      {
        type: "blockquote",
        content: [paragraph([text(LOREM_LIGHT.slice(0, 60))])],
      },
      {
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [text("const deck = [\"강타\", \"수비\"];\nplay(deck[0]);")],
      },
      {
        type: "table",
        content: [
          { type: "tableRow", content: [cell("tableHeader", "카드"), cell("tableHeader", "비용"), cell("tableHeader", "메모")] },
          { type: "tableRow", content: [cell("tableCell", "강타"), cell("tableCell", "2"), cell("tableCell", "lorem")] },
          { type: "tableRow", content: [cell("tableCell", "수비"), cell("tableCell", "1"), cell("tableCell", "ipsum")] },
        ],
      },
      {
        type: "details",
        attrs: { open: true },
        content: [
          { type: "detailsSummary", content: [text("Excepteur sint occaecat")] },
          { type: "detailsContent", content: [paragraph([text("cupidatat non proident, sunt in culpa.")])] },
        ],
      },
      { type: "horizontalRule" },
      paragraph([text("center · Lorem ipsum")], "center"),
      paragraph([text("right · dolor sit amet")], "right"),
      sampleAssetNode("PAGESTORM", "card", "left"),
      sampleAssetNode("CHEMICAL_X", "relic", "center"),
      youtubeNode(),
      {
        type: "pagestormLightSection",
        content: [
          heading(3, "Light section"),
          paragraph([text(LOREM_LIGHT.slice(0, 80))]),
        ],
      },
      paragraph([text("{ 로 게임 요소, / 로 사이트 경로를 이어서 써 보세요.")]),
    ],
  };
}

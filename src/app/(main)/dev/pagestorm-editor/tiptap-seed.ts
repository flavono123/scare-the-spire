import type { JSONContent } from "@tiptap/react";
import { defaultAssetWidth, SAMPLE_ASSETS, SAMPLE_YOUTUBE } from "./sample";

const emptyParagraph: JSONContent = { type: "paragraph" };

function text(
  value: string,
  marks?: JSONContent["marks"],
): JSONContent {
  return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function assetNode(
  id: string,
  extra: Record<string, unknown> = {},
): JSONContent {
  const asset = SAMPLE_ASSETS.find((item) => item.id === id);
  if (!asset) throw new Error(`missing sample asset ${id}`);
  const presentation = (extra.presentation as string | undefined) ?? "art";
  const width = presentation === "tiny" ? 72 : defaultAssetWidth(asset.kind);
  return {
    type: "gameAsset",
    attrs: {
      assetId: asset.id,
      kind: asset.kind,
      entityType: asset.kind,
      name: asset.name,
      imageUrl: asset.imageUrl,
      href: asset.href,
      align: extra.align ?? "center",
      linked: extra.linked ?? true,
      width: extra.width ?? width,
      height: extra.height ?? (asset.kind === "card" && presentation !== "tiny" ? Math.round(width * 1.56) : width),
      presentation,
      beta: extra.beta ?? false,
    },
  };
}

export const TIPTAP_SEED: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2, textAlign: "left" },
      content: [text("서류 폭풍 로렘 — 리젠트 다단히트")],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        text("강철도 다단히트고 "),
        text("우주 먼지", [{ type: "pagestormColor", attrs: { colorKey: "spire-gold" } }]),
        text("도 다단히트다. "),
        text("아이언클래드", [{ type: "pagestormColor", attrs: { colorKey: "character-ironclad" } }]),
        text(" 색으로 세게 때리고, "),
        text("사일런트", [{ type: "pagestormColor", attrs: { colorKey: "character-silent" } }]),
        text("는 버려가며 순환한다. 리젠트는 "),
        text("파동", [{ type: "sine" }, { type: "pagestormColor", attrs: { colorKey: "character-regent" } }]),
        text("처럼 위를 넘고, 디펙트 연산은 "),
        text("떨림", [{ type: "jitter" }, { type: "pagestormColor", attrs: { colorKey: "character-defect" } }]),
        text("처럼 계산이 흔들린다. 네크로바인더는 "),
        text("영혼", [{ type: "pagestormColor", attrs: { colorKey: "character-necrobinder" } }]),
        text("을 쌓는다."),
      ],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        text("그래서 "),
        text("케미컬 X", [{ type: "bold" }, { type: "pagestormColor", attrs: { colorKey: "spire-gold" } }]),
        text(" · 우주 먼지 · 천원돌파에 동시에 잘 들어간다. 카드는 아트만, 타일, Tiny를 따로 고른다."),
      ],
    },
    assetNode("PAGESTORM", { presentation: "art", align: "left", linked: true }),
    emptyParagraph,
    assetNode("STARDUST", { presentation: "tile", beta: true, align: "center", width: 156 }),
    emptyParagraph,
    assetNode("FALLING_STAR", { presentation: "tiny", align: "right", linked: false }),
    emptyParagraph,
    {
      type: "heading",
      attrs: { level: 3, textAlign: "left" },
      content: [text("유물과 발행 링크")],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        text("아래 케미컬 X는 발행해도 링크로 달리지 않는다. 잉크병은 링크로 남긴다."),
      ],
    },
    assetNode("CHEMICAL_X", { align: "left", linked: false }),
    emptyParagraph,
    assetNode("INK_BOTTLE", { align: "right", linked: true }),
    emptyParagraph,
    assetNode("HEAVENLY_DRILL", { presentation: "art", align: "center", linked: true }),
    emptyParagraph,
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            text("광자 베기로 뽑은 뒤 왕의 주먹을 다시 섞으면 다음 턴에도 뽑는다. "),
            text("초록", [{ type: "pagestormColor", attrs: { colorKey: "spire-green" } }]),
            text("은 버프, "),
            text("빨강", [{ type: "pagestormColor", attrs: { colorKey: "spire-red" } }, { type: "jitter" }]),
            text("은 너프."),
          ],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [text("별똥별로 스타 수급")] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [text("쳐내기는 방어 옵션")] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [text("{ 를 치면 초상 검색이 열린다. 평문만 치면 열리지 않는다.")] }],
        },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "youtubePlayer",
      attrs: {
        videoId: SAMPLE_YOUTUBE.videoId,
        title: SAMPLE_YOUTUBE.title,
        align: "center",
        width: 576,
        height: 324,
      },
    },
    emptyParagraph,
    {
      type: "ogBookmark",
      attrs: {
        url: "https://store.steampowered.com/app/2868840/Slay_the_Spire_2/",
        title: "Slay the Spire 2 on Steam",
        description: "The sequel to the world's most popular deckbuilder.",
        image: "/images/sts2/cards/pagestorm.webp",
        siteName: "Steam · mock OG snapshot",
        align: "left",
        linked: true,
        width: 576,
        height: 96,
      },
    },
    emptyParagraph,
    {
      type: "heading",
      attrs: { level: 3, textAlign: "left" },
      content: [text("장난감 상자 애셋")],
    },
    {
      type: "paragraph",
      content: [
        text("링크 카드와 다르다. 이거 아님 저거는 양쪽과 투표 버튼 전체, 어려운 결정은 티어보드 자체다."),
      ],
    },
    {
      type: "toyboxEmbed",
      attrs: {
        postId: "mock-tot-multihit",
        service: "/this-or-that",
        align: "center",
        linked: true,
        width: 576,
        height: 320,
      },
    },
    emptyParagraph,
    {
      type: "toyboxEmbed",
      attrs: {
        postId: "mock-dd-regent",
        service: "/decisions-decisions",
        align: "center",
        linked: false,
        width: 576,
        height: 280,
      },
    },
    emptyParagraph,
    {
      type: "paragraph",
      content: [
        text("고대의 존재는 "),
        text("파랑", [{ type: "pagestormColor", attrs: { colorKey: "spire-blue" } }]),
        text("이고, 은과 동은 보조 팔레트다. "),
        text("은", [{ type: "pagestormColor", attrs: { colorKey: "spire-silver" } }]),
        text(" · "),
        text("동", [{ type: "pagestormColor", attrs: { colorKey: "spire-bronze" } }]),
        text("."),
      ],
    },
  ],
};

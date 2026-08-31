import type { JSONContent } from "@tiptap/react";
import { defaultAssetWidth, SAMPLE_ASSETS, SAMPLE_YOUTUBE } from "./sample";

const emptyParagraph: JSONContent = { type: "paragraph" };

function assetNode(id: string): JSONContent {
  const asset = SAMPLE_ASSETS.find((item) => item.id === id);
  if (!asset) throw new Error(`missing sample asset ${id}`);
  return {
    type: "gameAsset",
    attrs: {
      assetId: asset.id,
      kind: asset.kind,
      name: asset.name,
      imageUrl: asset.imageUrl,
      href: asset.href,
      align: "center",
      linked: true,
      width: defaultAssetWidth(asset.kind),
    },
  };
}

export const TIPTAP_SEED: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2, textAlign: "left" },
      content: [{ type: "text", text: "다단히트 시너지" }],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        {
          type: "text",
          text: "강철도 다단히트고 우주 먼지도 다단히트다. 그래서 ",
        },
        { type: "text", marks: [{ type: "bold" }], text: "케미컬 X" },
        { type: "text", text: " · 우주 먼지 · 천원돌파에 동시에 잘 들어간다." },
      ],
    },
    assetNode("CHEMICAL_X"),
    emptyParagraph,
    assetNode("STARDUST"),
    emptyParagraph,
    assetNode("HEAVENLY_DRILL"),
    emptyParagraph,
    {
      type: "heading",
      attrs: { level: 3, textAlign: "left" },
      content: [{ type: "text", text: "덱 조작" }],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "광자 베기로 뽑은 뒤 왕의 주먹을 다시 섞으면 다음 턴에도 뽑는다.",
            },
          ],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "별똥별로 스타 수급" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "쳐내기는 방어 옵션" }],
            },
          ],
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
      },
    },
    emptyParagraph,
  ],
};

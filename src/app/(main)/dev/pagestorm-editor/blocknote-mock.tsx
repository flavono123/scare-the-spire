"use client";

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/ariakit";
import {
  createReactBlockSpec,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import "@blocknote/ariakit/style.css";
import {
  EditBlockChrome,
  GameAssetFigure,
  OgBookmarkFigure,
  YoutubePlayerFigure,
} from "./figures";
import { InsertBar } from "./insert-bar";
import {
  defaultAssetWidth,
  defaultPlayerWidth,
  filterPrefixItems,
  findSampleAsset,
  SAMPLE_ASSETS,
  SAMPLE_YOUTUBE,
  type MockAlign,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";
import "./pagestorm-mock-editor.css";

const alignSpec = {
  default: "center" as const,
  values: ["left", "center", "right"] as const,
};

function asAlign(value: string): MockAlign {
  return value === "left" || value === "right" ? value : "center";
}

const gameAssetSpec = createReactBlockSpec(
  {
    type: "gameAsset",
    propSchema: {
      assetId: { default: "" },
      name: { default: "" },
      imageUrl: { default: "" },
      href: { default: "" },
      kind: { default: "card" },
      align: alignSpec,
      linked: { default: true },
      width: { default: 128 },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const asset = findSampleAsset(block.props.assetId) ?? {
        id: block.props.assetId,
        kind: (block.props.kind as MockGameAsset["kind"]) || "card",
        name: block.props.name,
        imageUrl: block.props.imageUrl,
        href: block.props.href || "#",
      };
      const align = asAlign(block.props.align);
      const linked = block.props.linked !== false;
      const width = Number(block.props.width) || defaultAssetWidth(asset.kind);
      return (
        <div>
          <GameAssetFigure
            asset={asset}
            align={align}
            linked={linked}
            width={width}
            onResize={(size) => editor.updateBlock(block, { props: { width: size.width } })}
            onLinked={(next) => editor.updateBlock(block, { props: { linked: next } })}
          />
          <EditBlockChrome
            align={align}
            onAlign={(next) => editor.updateBlock(block, { props: { align: next } })}
          />
        </div>
      );
    },
  },
);

const youtubeSpec = createReactBlockSpec(
  {
    type: "youtubePlayer",
    propSchema: {
      videoId: { default: "" },
      title: { default: "YouTube" },
      align: alignSpec,
      width: { default: 576 },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const align = asAlign(block.props.align);
      const width = Number(block.props.width) || defaultPlayerWidth();
      return (
        <div>
          <YoutubePlayerFigure
            videoId={block.props.videoId}
            title={block.props.title}
            align={align}
            width={width}
            onResize={(size) => editor.updateBlock(block, { props: { width: size.width } })}
          />
          <EditBlockChrome
            align={align}
            onAlign={(next) => editor.updateBlock(block, { props: { align: next } })}
          />
        </div>
      );
    },
  },
);

const ogSpec = createReactBlockSpec(
  {
    type: "ogBookmark",
    propSchema: {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: "" },
      siteName: { default: "" },
      align: alignSpec,
      linked: { default: true },
      width: { default: 576 },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const bookmark: MockOgBookmark = {
        url: block.props.url,
        title: block.props.title,
        description: block.props.description,
        image: block.props.image || null,
        siteName: block.props.siteName,
      };
      const align = asAlign(block.props.align);
      const linked = block.props.linked !== false;
      const width = Number(block.props.width) || defaultPlayerWidth();
      return (
        <div>
          <OgBookmarkFigure
            bookmark={bookmark}
            align={align}
            linked={linked}
            width={width}
            onResize={(size) => editor.updateBlock(block, { props: { width: size.width } })}
            onLinked={(next) => editor.updateBlock(block, { props: { linked: next } })}
          />
          <EditBlockChrome
            align={align}
            onAlign={(next) => editor.updateBlock(block, { props: { align: next } })}
          />
        </div>
      );
    },
  },
);

const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    quote: defaultBlockSpecs.quote,
    divider: defaultBlockSpecs.divider,
    gameAsset: gameAssetSpec(),
    youtubePlayer: youtubeSpec(),
    ogBookmark: ogSpec(),
  },
});

function assetProps(asset: MockGameAsset) {
  return {
    assetId: asset.id,
    name: asset.name,
    imageUrl: asset.imageUrl,
    href: asset.href,
    kind: asset.kind,
    align: "center" as const,
    linked: true,
    width: defaultAssetWidth(asset.kind),
  };
}

const steamOg = {
  url: "https://store.steampowered.com/app/2868840/Slay_the_Spire_2/",
  title: "Slay the Spire 2 on Steam",
  description: "The sequel to the world's most popular deckbuilder.",
  image: "/images/sts2/cards/pagestorm.webp",
  siteName: "Steam · mock OG snapshot",
  align: "left" as const,
  linked: true,
  width: 576,
};

export function BlockNotePagestormMock() {
  const editor = useCreateBlockNote({
    schema,
    defaultStyles: false,
    initialContent: [
      {
        type: "heading",
        props: { level: 2 },
        content: "다단히트 시너지",
      },
      {
        type: "paragraph",
        content:
          "강철도 다단히트고 우주 먼지도 다단히트다. 그래서 케미컬 X · 우주 먼지 · 천원돌파에 동시에 잘 들어간다.",
      },
      {
        type: "gameAsset",
        props: assetProps(SAMPLE_ASSETS[0]),
      },
      { type: "paragraph", content: "" },
      {
        type: "gameAsset",
        props: assetProps(SAMPLE_ASSETS[1]),
      },
      { type: "paragraph", content: "" },
      {
        type: "gameAsset",
        props: assetProps(SAMPLE_ASSETS[2]),
      },
      { type: "paragraph", content: "" },
      {
        type: "heading",
        props: { level: 3 },
        content: "덱 조작",
      },
      {
        type: "quote",
        content: "광자 베기로 뽑은 뒤 왕의 주먹을 다시 섞으면 다음 턴에도 뽑는다.",
      },
      { type: "divider" },
      {
        type: "youtubePlayer",
        props: {
          videoId: SAMPLE_YOUTUBE.videoId,
          title: SAMPLE_YOUTUBE.title,
          align: "center",
        },
      },
      {
        type: "ogBookmark",
        props: steamOg,
      },
    ],
  }, []);

  const insertAfterCursor = (block: Record<string, unknown>) => {
    try {
      const cursor = editor.getTextCursorPosition();
      editor.insertBlocks([block as never], cursor.block, "after");
    } catch {
      const last = editor.document.at(-1);
      if (last) editor.insertBlocks([block as never], last, "after");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/20">
      <InsertBar
        onInsertAsset={(asset) =>
          insertAfterCursor({ type: "gameAsset", props: assetProps(asset) })}
        onInsertYoutube={(videoId, title) =>
          insertAfterCursor({
            type: "youtubePlayer",
            props: { videoId, title, align: "center", width: 576 },
          })}
        onInsertOg={(bookmark) =>
          insertAfterCursor({
            type: "ogBookmark",
            props: { ...bookmark, image: bookmark.image ?? "", align: "center", linked: true, width: 576 },
          })}
      />
      <BlockNoteView editor={editor} theme="dark" slashMenu={false} filePanel={false} emojiPicker={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            getDefaultReactSlashMenuItems(editor).filter((item) => {
              if (/image|video|audio|file|embed/i.test(item.title)) return false;
              return item.title.toLowerCase().includes(query.toLowerCase());
            })}
        />
        <SuggestionMenuController
          triggerCharacter="{"
          getItems={async (query) =>
            filterPrefixItems(query).map((asset) => ({
              title: asset.name,
              subtext: asset.kind,
              onItemClick: () =>
                insertAfterCursor({ type: "gameAsset", props: assetProps(asset) }),
            }))}
        />
      </BlockNoteView>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  type Klass,
  type LexicalNode,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import { INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from "@lexical/list";
import { $setBlocksType } from "@lexical/selection";
import { InsertBar, MarkToolbar, mockButtonClass } from "./insert-bar";
import {
  $createGameAssetLexicalNode,
  $createOgLexicalNode,
  $createYoutubeLexicalNode,
  GameAssetLexicalNode,
  OgLexicalNode,
  YoutubeLexicalNode,
} from "./lexical-nodes";
import { SAMPLE_ASSETS, SAMPLE_YOUTUBE, type MockGameAsset, type MockOgBookmark } from "./sample";
import "./pagestorm-mock-editor.css";

const NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  GameAssetLexicalNode,
  YoutubeLexicalNode,
  OgLexicalNode,
];

function sampleAsset(id: string): MockGameAsset {
  const asset = SAMPLE_ASSETS.find((item) => item.id === id);
  if (!asset) throw new Error(id);
  return asset;
}

function SeedPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      const first = root.getFirstChild();
      const emptyStarter = first
        && root.getChildrenSize() === 1
        && $isParagraphNode(first)
        && first.getTextContent() === "";
      if (!emptyStarter && root.getTextContentSize() > 0) return;
      root.clear();
      const heading = $createHeadingNode("h2");
      heading.append($createTextNode("다단히트 시너지"));
      const lead = $createParagraphNode();
      lead.append(
        $createTextNode(
          "강철도 다단히트고 우주 먼지도 다단히트다. 그래서 케미컬 X · 우주 먼지 · 천원돌파에 동시에 잘 들어간다.",
        ),
      );
      root.append(heading, lead);
      root.append($createGameAssetLexicalNode(sampleAsset("CHEMICAL_X")));
      root.append($createGameAssetLexicalNode(sampleAsset("STARDUST")));
      root.append($createGameAssetLexicalNode(sampleAsset("HEAVENLY_DRILL")));
      const sub = $createHeadingNode("h3");
      sub.append($createTextNode("덱 조작"));
      const quote = $createQuoteNode();
      quote.append(
        $createTextNode("광자 베기로 뽑은 뒤 왕의 주먹을 다시 섞으면 다음 턴에도 뽑는다."),
      );
      root.append(sub, quote);
      root.append(
        $createYoutubeLexicalNode(SAMPLE_YOUTUBE.videoId, SAMPLE_YOUTUBE.title),
      );
      root.append(
        $createOgLexicalNode({
          url: "https://store.steampowered.com/app/2868840/Slay_the_Spire_2/",
          title: "Slay the Spire 2 on Steam",
          description: "The sequel to the world's most popular deckbuilder.",
          image: "/images/sts2/cards/pagestorm.webp",
          siteName: "Steam · mock OG snapshot",
        }, "left"),
      );
    });
  }, [editor]);
  return null;
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  return (
    <MarkToolbar>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        B
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        I
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h2"));
            }
          });
        }}
      >
        H2
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h3"));
            }
          });
        }}
      >
        H3
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        목록
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createQuoteNode());
            }
          });
        }}
      >
        인용
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}
      >
        좌
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
      >
        중
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}
      >
        우
      </button>
    </MarkToolbar>
  );
}

function InsertPluginBar() {
  const [editor] = useLexicalComposerContext();
  const insertNode = (factory: () => LexicalNode) => {
    editor.update(() => {
      const selection = $getSelection();
      const node = factory();
      if ($isRangeSelection(selection)) {
        selection.insertNodes([node]);
      } else {
        $getRoot().append(node);
      }
    });
  };

  return (
    <InsertBar
      onInsertAsset={(asset) => insertNode(() => $createGameAssetLexicalNode(asset))}
      onInsertYoutube={(videoId, title) =>
        insertNode(() => $createYoutubeLexicalNode(videoId, title))}
      onInsertOg={(bookmark: MockOgBookmark) =>
        insertNode(() => $createOgLexicalNode(bookmark))}
    />
  );
}

export function LexicalPagestormMock() {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "pagestorm-lexical-mock",
        theme: {
          paragraph: "mb-2",
        },
        onError(error) {
          console.error(error);
        },
        nodes: NODES,
      }}
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card/20">
        <Toolbar />
        <InsertPluginBar />
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="pagestorm-mock-editor" />
          }
          placeholder={
            <div className="pointer-events-none px-4 py-3 text-sm text-muted-foreground">
              문단을 입력하세요
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <SeedPlugin />
      </div>
    </LexicalComposer>
  );
}

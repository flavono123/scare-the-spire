"use client";

import type { ReactElement } from "react";
import {
  $getNodeByKey,
  DecoratorNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  GameAssetFigure,
  OgBookmarkFigure,
  YoutubePlayerFigure,
} from "./figures";
import { AlignButtons } from "./insert-bar";
import type { MockAlign, MockGameAsset, MockOgBookmark } from "./sample";

function AlignableDecorator({
  nodeKey,
  align,
  children,
}: {
  nodeKey: NodeKey;
  align: MockAlign;
  children: ReactElement;
}) {
  const [editor] = useLexicalComposerContext();
  return (
    <div>
      {children}
      <div className="flex justify-center gap-1 pb-2">
        <AlignButtons
          value={align}
          onChange={(next) => {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node instanceof AlignableLexicalNode) {
                node.setAlign(next);
              }
            });
          }}
        />
      </div>
    </div>
  );
}

abstract class AlignableLexicalNode extends DecoratorNode<ReactElement> {
  abstract setAlign(align: MockAlign): void;
}

type SerializedAsset = Spread<
  { payload: { asset: MockGameAsset; align: MockAlign } },
  SerializedLexicalNode
>;

export class GameAssetLexicalNode extends AlignableLexicalNode {
  __asset: MockGameAsset;
  __align: MockAlign;

  static getType(): string {
    return "pagestorm-asset";
  }

  static clone(node: GameAssetLexicalNode): GameAssetLexicalNode {
    return new GameAssetLexicalNode(node.__asset, node.__align, node.__key);
  }

  constructor(asset: MockGameAsset, align: MockAlign = "center", key?: NodeKey) {
    super(key);
    this.__asset = asset;
    this.__align = align;
  }

  static importJSON(serialized: SerializedAsset): GameAssetLexicalNode {
    return $createGameAssetLexicalNode(serialized.payload.asset, serialized.payload.align);
  }

  exportJSON(): SerializedAsset {
    return {
      type: "pagestorm-asset",
      version: 1,
      payload: { asset: this.__asset, align: this.__align },
    };
  }

  createDOM(): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  setAlign(align: MockAlign): void {
    const writable = this.getWritable();
    writable.__align = align;
  }

  decorate(): ReactElement {
    return (
      <AlignableDecorator nodeKey={this.getKey()} align={this.__align}>
        <GameAssetFigure asset={this.__asset} align={this.__align} />
      </AlignableDecorator>
    );
  }

  isInline(): false {
    return false;
  }
}

export function $createGameAssetLexicalNode(
  asset: MockGameAsset,
  align: MockAlign = "center",
): GameAssetLexicalNode {
  return new GameAssetLexicalNode(asset, align);
}

type SerializedYoutube = Spread<
  { payload: { videoId: string; title: string; align: MockAlign } },
  SerializedLexicalNode
>;

export class YoutubeLexicalNode extends AlignableLexicalNode {
  __videoId: string;
  __title: string;
  __align: MockAlign;

  static getType(): string {
    return "pagestorm-youtube";
  }

  static clone(node: YoutubeLexicalNode): YoutubeLexicalNode {
    return new YoutubeLexicalNode(node.__videoId, node.__title, node.__align, node.__key);
  }

  constructor(videoId: string, title: string, align: MockAlign = "center", key?: NodeKey) {
    super(key);
    this.__videoId = videoId;
    this.__title = title;
    this.__align = align;
  }

  static importJSON(serialized: SerializedYoutube): YoutubeLexicalNode {
    return $createYoutubeLexicalNode(
      serialized.payload.videoId,
      serialized.payload.title,
      serialized.payload.align,
    );
  }

  exportJSON(): SerializedYoutube {
    return {
      type: "pagestorm-youtube",
      version: 1,
      payload: {
        videoId: this.__videoId,
        title: this.__title,
        align: this.__align,
      },
    };
  }

  createDOM(): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  setAlign(align: MockAlign): void {
    const writable = this.getWritable();
    writable.__align = align;
  }

  decorate(): ReactElement {
    return (
      <AlignableDecorator nodeKey={this.getKey()} align={this.__align}>
        <YoutubePlayerFigure
          videoId={this.__videoId}
          title={this.__title}
          align={this.__align}
        />
      </AlignableDecorator>
    );
  }

  isInline(): false {
    return false;
  }
}

export function $createYoutubeLexicalNode(
  videoId: string,
  title: string,
  align: MockAlign = "center",
): YoutubeLexicalNode {
  return new YoutubeLexicalNode(videoId, title, align);
}

type SerializedOg = Spread<
  { payload: { bookmark: MockOgBookmark; align: MockAlign } },
  SerializedLexicalNode
>;

export class OgLexicalNode extends AlignableLexicalNode {
  __bookmark: MockOgBookmark;
  __align: MockAlign;

  static getType(): string {
    return "pagestorm-og";
  }

  static clone(node: OgLexicalNode): OgLexicalNode {
    return new OgLexicalNode(node.__bookmark, node.__align, node.__key);
  }

  constructor(bookmark: MockOgBookmark, align: MockAlign = "center", key?: NodeKey) {
    super(key);
    this.__bookmark = bookmark;
    this.__align = align;
  }

  static importJSON(serialized: SerializedOg): OgLexicalNode {
    return $createOgLexicalNode(serialized.payload.bookmark, serialized.payload.align);
  }

  exportJSON(): SerializedOg {
    return {
      type: "pagestorm-og",
      version: 1,
      payload: { bookmark: this.__bookmark, align: this.__align },
    };
  }

  createDOM(): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  setAlign(align: MockAlign): void {
    const writable = this.getWritable();
    writable.__align = align;
  }

  decorate(): ReactElement {
    return (
      <AlignableDecorator nodeKey={this.getKey()} align={this.__align}>
        <OgBookmarkFigure bookmark={this.__bookmark} align={this.__align} />
      </AlignableDecorator>
    );
  }

  isInline(): false {
    return false;
  }
}

export function $createOgLexicalNode(
  bookmark: MockOgBookmark,
  align: MockAlign = "center",
): OgLexicalNode {
  return new OgLexicalNode(bookmark, align);
}

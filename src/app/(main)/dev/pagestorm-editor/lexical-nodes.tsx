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
  EditBlockChrome,
  GameAssetFigure,
  OgBookmarkFigure,
  YoutubePlayerFigure,
} from "./figures";
import {
  defaultAssetWidth,
  defaultPlayerWidth,
  type MockAlign,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";

function BlockDecorator({
  nodeKey,
  align,
  linked,
  showLink,
  children,
}: {
  nodeKey: NodeKey;
  align: MockAlign;
  linked?: boolean;
  showLink?: boolean;
  children: ReactElement;
}) {
  const [editor] = useLexicalComposerContext();
  const patch = (fn: (node: AlignableLexicalNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof AlignableLexicalNode) fn(node);
    });
  };
  return (
    <div>
      {children}
      <EditBlockChrome
        align={align}
        onAlign={(next) => patch((node) => node.setAlign(next))}
        linked={linked}
        onLinked={showLink ? (next) => patch((node) => node.setLinked(next)) : undefined}
      />
    </div>
  );
}

abstract class AlignableLexicalNode extends DecoratorNode<ReactElement> {
  abstract setAlign(align: MockAlign): void;
  setLinked(linked: boolean): void {
    void linked;
  }
  setWidth(width: number): void {
    void width;
  }
  isKeyboardSelectable(): boolean {
    return true;
  }
  isIsolating(): boolean {
    return false;
  }
}

function GameAssetDecorate({
  nodeKey,
  asset,
  align,
  linked,
  width,
}: {
  nodeKey: NodeKey;
  asset: MockGameAsset;
  align: MockAlign;
  linked: boolean;
  width: number;
}) {
  const [editor] = useLexicalComposerContext();
  return (
    <BlockDecorator nodeKey={nodeKey} align={align} linked={linked} showLink>
      <GameAssetFigure
        asset={asset}
        align={align}
        linked={linked}
        width={width}
        onResize={(next) => {
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node instanceof GameAssetLexicalNode) node.setWidth(next);
          });
        }}
      />
    </BlockDecorator>
  );
}

function YoutubeDecorate({
  nodeKey,
  videoId,
  title,
  align,
  width,
}: {
  nodeKey: NodeKey;
  videoId: string;
  title: string;
  align: MockAlign;
  width: number;
}) {
  const [editor] = useLexicalComposerContext();
  return (
    <BlockDecorator nodeKey={nodeKey} align={align}>
      <YoutubePlayerFigure
        videoId={videoId}
        title={title}
        align={align}
        width={width}
        onResize={(next) => {
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node instanceof YoutubeLexicalNode) node.setWidth(next);
          });
        }}
      />
    </BlockDecorator>
  );
}

function OgDecorate({
  nodeKey,
  bookmark,
  align,
  linked,
  width,
}: {
  nodeKey: NodeKey;
  bookmark: MockOgBookmark;
  align: MockAlign;
  linked: boolean;
  width: number;
}) {
  const [editor] = useLexicalComposerContext();
  return (
    <BlockDecorator nodeKey={nodeKey} align={align} linked={linked} showLink>
      <OgBookmarkFigure
        bookmark={bookmark}
        align={align}
        linked={linked}
        width={width}
        onResize={(next) => {
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node instanceof OgLexicalNode) node.setWidth(next);
          });
        }}
      />
    </BlockDecorator>
  );
}

type SerializedAsset = Spread<
  { payload: { asset: MockGameAsset; align: MockAlign; linked: boolean; width: number } },
  SerializedLexicalNode
>;

export class GameAssetLexicalNode extends AlignableLexicalNode {
  __asset: MockGameAsset;
  __align: MockAlign;
  __linked: boolean;
  __width: number;

  static getType(): string {
    return "pagestorm-asset";
  }

  static clone(node: GameAssetLexicalNode): GameAssetLexicalNode {
    return new GameAssetLexicalNode(
      node.__asset,
      node.__align,
      node.__linked,
      node.__width,
      node.__key,
    );
  }

  constructor(
    asset: MockGameAsset,
    align: MockAlign = "center",
    linked = true,
    width = defaultAssetWidth(asset.kind),
    key?: NodeKey,
  ) {
    super(key);
    this.__asset = asset;
    this.__align = align;
    this.__linked = linked;
    this.__width = width;
  }

  static importJSON(serialized: SerializedAsset): GameAssetLexicalNode {
    return $createGameAssetLexicalNode(
      serialized.payload.asset,
      serialized.payload.align,
      serialized.payload.linked,
      serialized.payload.width,
    );
  }

  exportJSON(): SerializedAsset {
    return {
      type: "pagestorm-asset",
      version: 1,
      payload: {
        asset: this.__asset,
        align: this.__align,
        linked: this.__linked,
        width: this.__width,
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
    this.getWritable().__align = align;
  }

  setLinked(linked: boolean): void {
    this.getWritable().__linked = linked;
  }

  setWidth(width: number): void {
    this.getWritable().__width = width;
  }

  decorate(): ReactElement {
    return (
      <GameAssetDecorate
        nodeKey={this.getKey()}
        asset={this.__asset}
        align={this.__align}
        linked={this.__linked}
        width={this.__width}
      />
    );
  }

  isInline(): false {
    return false;
  }
}

export function $createGameAssetLexicalNode(
  asset: MockGameAsset,
  align: MockAlign = "center",
  linked = true,
  width = defaultAssetWidth(asset.kind),
): GameAssetLexicalNode {
  return new GameAssetLexicalNode(asset, align, linked, width);
}

type SerializedYoutube = Spread<
  { payload: { videoId: string; title: string; align: MockAlign; width: number } },
  SerializedLexicalNode
>;

export class YoutubeLexicalNode extends AlignableLexicalNode {
  __videoId: string;
  __title: string;
  __align: MockAlign;
  __width: number;

  static getType(): string {
    return "pagestorm-youtube";
  }

  static clone(node: YoutubeLexicalNode): YoutubeLexicalNode {
    return new YoutubeLexicalNode(
      node.__videoId,
      node.__title,
      node.__align,
      node.__width,
      node.__key,
    );
  }

  constructor(
    videoId: string,
    title: string,
    align: MockAlign = "center",
    width = defaultPlayerWidth(),
    key?: NodeKey,
  ) {
    super(key);
    this.__videoId = videoId;
    this.__title = title;
    this.__align = align;
    this.__width = width;
  }

  static importJSON(serialized: SerializedYoutube): YoutubeLexicalNode {
    return $createYoutubeLexicalNode(
      serialized.payload.videoId,
      serialized.payload.title,
      serialized.payload.align,
      serialized.payload.width,
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
        width: this.__width,
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
    this.getWritable().__align = align;
  }

  setWidth(width: number): void {
    this.getWritable().__width = width;
  }

  decorate(): ReactElement {
    return (
      <YoutubeDecorate
        nodeKey={this.getKey()}
        videoId={this.__videoId}
        title={this.__title}
        align={this.__align}
        width={this.__width}
      />
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
  width = defaultPlayerWidth(),
): YoutubeLexicalNode {
  return new YoutubeLexicalNode(videoId, title, align, width);
}

type SerializedOg = Spread<
  {
    payload: {
      bookmark: MockOgBookmark;
      align: MockAlign;
      linked: boolean;
      width: number;
    };
  },
  SerializedLexicalNode
>;

export class OgLexicalNode extends AlignableLexicalNode {
  __bookmark: MockOgBookmark;
  __align: MockAlign;
  __linked: boolean;
  __width: number;

  static getType(): string {
    return "pagestorm-og";
  }

  static clone(node: OgLexicalNode): OgLexicalNode {
    return new OgLexicalNode(
      node.__bookmark,
      node.__align,
      node.__linked,
      node.__width,
      node.__key,
    );
  }

  constructor(
    bookmark: MockOgBookmark,
    align: MockAlign = "center",
    linked = true,
    width = defaultPlayerWidth(),
    key?: NodeKey,
  ) {
    super(key);
    this.__bookmark = bookmark;
    this.__align = align;
    this.__linked = linked;
    this.__width = width;
  }

  static importJSON(serialized: SerializedOg): OgLexicalNode {
    return $createOgLexicalNode(
      serialized.payload.bookmark,
      serialized.payload.align,
      serialized.payload.linked,
      serialized.payload.width,
    );
  }

  exportJSON(): SerializedOg {
    return {
      type: "pagestorm-og",
      version: 1,
      payload: {
        bookmark: this.__bookmark,
        align: this.__align,
        linked: this.__linked,
        width: this.__width,
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
    this.getWritable().__align = align;
  }

  setLinked(linked: boolean): void {
    this.getWritable().__linked = linked;
  }

  setWidth(width: number): void {
    this.getWritable().__width = width;
  }

  decorate(): ReactElement {
    return (
      <OgDecorate
        nodeKey={this.getKey()}
        bookmark={this.__bookmark}
        align={this.__align}
        linked={this.__linked}
        width={this.__width}
      />
    );
  }

  isInline(): false {
    return false;
  }
}

export function $createOgLexicalNode(
  bookmark: MockOgBookmark,
  align: MockAlign = "center",
  linked = true,
  width = defaultPlayerWidth(),
): OgLexicalNode {
  return new OgLexicalNode(bookmark, align, linked, width);
}

"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { AlignButtons } from "./insert-bar";
import {
  GameAssetFigure,
  OgBookmarkFigure,
  YoutubePlayerFigure,
} from "./figures";
import {
  findSampleAsset,
  type MockAlign,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";

function asAlign(value: unknown): MockAlign {
  return value === "center" || value === "right" ? value : "left";
}

function GameAssetView({ node, updateAttributes, selected }: NodeViewProps) {
  const asset = findSampleAsset(String(node.attrs.assetId ?? "")) ?? {
    id: String(node.attrs.assetId ?? ""),
    kind: (node.attrs.kind as MockGameAsset["kind"]) || "card",
    name: String(node.attrs.name ?? ""),
    imageUrl: String(node.attrs.imageUrl ?? ""),
    href: String(node.attrs.href ?? "#"),
  };
  const align = asAlign(node.attrs.align);
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <GameAssetFigure asset={asset} align={align} />
        <div className="flex justify-center gap-1 pb-2">
          <AlignButtons value={align} onChange={(next) => updateAttributes({ align: next })} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function YoutubeView({ node, updateAttributes, selected }: NodeViewProps) {
  const align = asAlign(node.attrs.align);
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <YoutubePlayerFigure
          videoId={String(node.attrs.videoId ?? "")}
          title={String(node.attrs.title ?? "YouTube")}
          align={align}
        />
        <div className="flex justify-center gap-1 pb-2">
          <AlignButtons value={align} onChange={(next) => updateAttributes({ align: next })} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function OgView({ node, updateAttributes, selected }: NodeViewProps) {
  const align = asAlign(node.attrs.align);
  const bookmark: MockOgBookmark = {
    url: String(node.attrs.url ?? ""),
    title: String(node.attrs.title ?? ""),
    description: String(node.attrs.description ?? ""),
    image: (node.attrs.image as string | null) || null,
    siteName: String(node.attrs.siteName ?? ""),
  };
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <OgBookmarkFigure bookmark={bookmark} align={align} />
        <div className="flex justify-center gap-1 pb-2">
          <AlignButtons value={align} onChange={(next) => updateAttributes({ align: next })} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const GameAssetNode = Node.create({
  name: "gameAsset",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      assetId: { default: "" },
      kind: { default: "card" },
      name: { default: "" },
      imageUrl: { default: "" },
      href: { default: "" },
      align: { default: "center" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pagestorm-asset]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pagestorm-asset": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(GameAssetView);
  },
});

export const YoutubePlayerNode = Node.create({
  name: "youtubePlayer",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      videoId: { default: "" },
      title: { default: "YouTube" },
      align: { default: "center" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pagestorm-youtube]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pagestorm-youtube": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView);
  },
});

export const OgBookmarkNode = Node.create({
  name: "ogBookmark",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: null },
      siteName: { default: "" },
      align: { default: "center" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pagestorm-og]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pagestorm-og": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(OgView);
  },
});

export function gameAssetAttrs(asset: MockGameAsset, align: MockAlign = "center") {
  return {
    assetId: asset.id,
    kind: asset.kind,
    name: asset.name,
    imageUrl: asset.imageUrl,
    href: asset.href,
    align,
  };
}

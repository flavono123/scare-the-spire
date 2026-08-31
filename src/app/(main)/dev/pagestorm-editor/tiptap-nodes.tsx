"use client";

import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import {
  EditBlockChrome,
  GameAssetFigure,
  OgBookmarkFigure,
  YoutubePlayerFigure,
} from "./figures";
import {
  defaultAssetWidth,
  defaultPlayerWidth,
  findSampleAsset,
  type MockAlign,
  type MockAssetKind,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";

function asAlign(value: unknown): MockAlign {
  return value === "center" || value === "right" ? value : "left";
}

function asBool(value: unknown, fallback = true): boolean {
  if (value === false || value === "false" || value === 0) return false;
  if (value === true || value === "true" || value === 1) return true;
  return fallback;
}

function asWidth(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function atomKeyboard(name: string) {
  return {
    Enter: ({ editor }: { editor: Editor }) => {
      if (!editor.isActive(name)) return false;
      return editor.commands.createParagraphNear();
    },
    Backspace: ({ editor }: { editor: Editor }) => {
      if (!editor.isActive(name)) return false;
      return editor.chain().deleteSelection().run();
    },
    Delete: ({ editor }: { editor: Editor }) => {
      if (!editor.isActive(name)) return false;
      return editor.chain().deleteSelection().run();
    },
  };
}

const nodeViewOptions = {
  stopEvent: ({ event }: { event: Event }) => {
    const target = event.target;
    return target instanceof HTMLElement && Boolean(target.closest("[data-asset-chrome]"));
  },
};

function GameAssetView({ node, updateAttributes, selected }: NodeViewProps) {
  const kind = (node.attrs.kind as MockAssetKind) || "card";
  const asset = findSampleAsset(String(node.attrs.assetId ?? "")) ?? {
    id: String(node.attrs.assetId ?? ""),
    kind,
    name: String(node.attrs.name ?? ""),
    imageUrl: String(node.attrs.imageUrl ?? ""),
    href: String(node.attrs.href ?? "#"),
  };
  const align = asAlign(node.attrs.align);
  const linked = asBool(node.attrs.linked);
  const width = asWidth(node.attrs.width, defaultAssetWidth(kind));
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <GameAssetFigure
          asset={asset}
          align={align}
          linked={linked}
          width={width}
          onResize={(next) => updateAttributes({ width: next })}
        />
        <EditBlockChrome
          align={align}
          onAlign={(next) => updateAttributes({ align: next })}
          linked={linked}
          onLinked={(next) => updateAttributes({ linked: next })}
        />
      </div>
    </NodeViewWrapper>
  );
}

function YoutubeView({ node, updateAttributes, selected }: NodeViewProps) {
  const align = asAlign(node.attrs.align);
  const width = asWidth(node.attrs.width, defaultPlayerWidth());
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <YoutubePlayerFigure
          videoId={String(node.attrs.videoId ?? "")}
          title={String(node.attrs.title ?? "YouTube")}
          align={align}
          width={width}
          onResize={(next) => updateAttributes({ width: next })}
        />
        <EditBlockChrome
          align={align}
          onAlign={(next) => updateAttributes({ align: next })}
        />
      </div>
    </NodeViewWrapper>
  );
}

function OgView({ node, updateAttributes, selected }: NodeViewProps) {
  const align = asAlign(node.attrs.align);
  const linked = asBool(node.attrs.linked);
  const width = asWidth(node.attrs.width, defaultPlayerWidth());
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
        <OgBookmarkFigure
          bookmark={bookmark}
          align={align}
          linked={linked}
          width={width}
          onResize={(next) => updateAttributes({ width: next })}
        />
        <EditBlockChrome
          align={align}
          onAlign={(next) => updateAttributes({ align: next })}
          linked={linked}
          onLinked={(next) => updateAttributes({ linked: next })}
        />
      </div>
    </NodeViewWrapper>
  );
}

export const GameAssetNode = Node.create({
  name: "gameAsset",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      assetId: { default: "" },
      kind: { default: "card" },
      name: { default: "" },
      imageUrl: { default: "" },
      href: { default: "" },
      align: { default: "center" },
      linked: { default: true },
      width: { default: 128 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pagestorm-asset]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pagestorm-asset": "" })];
  },
  addKeyboardShortcuts() {
    return atomKeyboard(this.name);
  },
  addNodeView() {
    return ReactNodeViewRenderer(GameAssetView, nodeViewOptions);
  },
});

export const YoutubePlayerNode = Node.create({
  name: "youtubePlayer",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      videoId: { default: "" },
      title: { default: "YouTube" },
      align: { default: "center" },
      width: { default: 576 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pagestorm-youtube]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pagestorm-youtube": "" })];
  },
  addKeyboardShortcuts() {
    return atomKeyboard(this.name);
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView, nodeViewOptions);
  },
});

export const OgBookmarkNode = Node.create({
  name: "ogBookmark",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: null },
      siteName: { default: "" },
      align: { default: "center" },
      linked: { default: true },
      width: { default: 576 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pagestorm-og]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pagestorm-og": "" })];
  },
  addKeyboardShortcuts() {
    return atomKeyboard(this.name);
  },
  addNodeView() {
    return ReactNodeViewRenderer(OgView, nodeViewOptions);
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
    linked: true,
    width: defaultAssetWidth(asset.kind),
  };
}

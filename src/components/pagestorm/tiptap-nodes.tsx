"use client";

import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { GameAssetFigure, OgBookmarkFigure, YoutubePlayerFigure } from "./figures";
import {
  findPagestormEntity,
  usePagestormChrome,
  usePagestormEntities,
} from "./entities-context";
import { parseYouTubeVideoId } from "@/lib/youtube-reference";
import {
  defaultAssetWidth,
  defaultPlayerWidth,
  findSampleAsset,
  type CardPresentation,
  type MockAlign,
  type MockAssetKind,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";
import { ToyboxEmbedFigure } from "./toybox-embed";

export const PAGESTORM_BLOCK_NODE_NAMES = [
  "gameAsset",
  "youtubePlayer",
  "ogBookmark",
  "toyboxEmbed",
] as const;

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

function asPresentation(value: unknown): CardPresentation {
  return value === "tile" || value === "tiny" ? value : "art";
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
  const entities = usePagestormEntities();
  const mode = usePagestormChrome();
  const kind = (node.attrs.kind as MockAssetKind) || "card";
  const entityType = String(node.attrs.entityType || kind);
  const entity = findPagestormEntity(entities, entityType, String(node.attrs.assetId ?? ""));
  const asset: MockGameAsset = entity
    ? {
      id: entity.id,
      kind: entity.type,
      name: entity.nameKo,
      imageUrl: entity.imageUrl ?? String(node.attrs.imageUrl ?? ""),
      href: entity.href ?? String(node.attrs.href ?? "#"),
    }
    : findSampleAsset(String(node.attrs.assetId ?? ""), entityType) ?? {
      id: String(node.attrs.assetId ?? ""),
      kind,
      name: String(node.attrs.name ?? ""),
      imageUrl: String(node.attrs.imageUrl ?? ""),
      href: String(node.attrs.href ?? "#"),
    };
  const align = asAlign(node.attrs.align);
  const linked = asBool(node.attrs.linked);
  const presentation = asPresentation(node.attrs.presentation);
  const beta = asBool(node.attrs.beta, false);
  const width = asWidth(node.attrs.width, defaultAssetWidth(asset.kind));
  const height = asWidth(
    node.attrs.height,
    asset.kind === "card" && presentation !== "tiny" ? Math.round(width * 1.56) : width,
  );
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <GameAssetFigure
          asset={asset}
          align={align}
          mode={mode}
          selected={selected}
          linked={linked}
          width={width}
          height={height}
          presentation={presentation}
          beta={beta}
          card={entity?.cardData}
          onResize={(size) => updateAttributes({ width: size.width, height: size.height })}
          onLinked={(next) => updateAttributes({ linked: next })}
          onAlign={(next) => updateAttributes({ align: next })}
        />
      </div>
    </NodeViewWrapper>
  );
}

function YoutubeView({ node, updateAttributes, selected }: NodeViewProps) {
  const mode = usePagestormChrome();
  const align = asAlign(node.attrs.align);
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <YoutubePlayerFigure
          videoId={String(node.attrs.videoId ?? "")}
          title={String(node.attrs.title ?? "YouTube")}
          align={align}
          mode={mode}
          selected={selected}
          onTitle={(title) => updateAttributes({ title })}
          onUrl={(url) => {
            const videoId = parseYouTubeVideoId(url);
            if (videoId) updateAttributes({ videoId });
          }}
          onAlign={(next) => updateAttributes({ align: next })}
        />
      </div>
    </NodeViewWrapper>
  );
}

function OgView({ node, updateAttributes, selected }: NodeViewProps) {
  const mode = usePagestormChrome();
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
        <OgBookmarkFigure
          bookmark={bookmark}
          align={align}
          mode={mode}
          selected={selected}
          onTitle={(title) => updateAttributes({ title })}
          onUrl={(url) => updateAttributes({ url })}
          onAlign={(next) => updateAttributes({ align: next })}
        />
      </div>
    </NodeViewWrapper>
  );
}

function ToyboxView({ node, updateAttributes, selected }: NodeViewProps) {
  const mode = usePagestormChrome();
  const align = asAlign(node.attrs.align);
  const linked = asBool(node.attrs.linked);
  const width = asWidth(node.attrs.width, defaultPlayerWidth());
  const height = asWidth(node.attrs.height, 240);
  return (
    <NodeViewWrapper>
      <div className={selected ? "rounded-md ring-1 ring-primary/70" : undefined}>
        <ToyboxEmbedFigure
          postId={String(node.attrs.postId ?? "")}
          align={align}
          mode={mode}
          selected={selected}
          linked={linked}
          width={width}
          height={height}
          onResize={(size) => updateAttributes({ width: size.width, height: size.height })}
          onLinked={(next) => updateAttributes({ linked: next })}
          onAlign={(next) => updateAttributes({ align: next })}
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
      entityType: { default: "card" },
      name: { default: "" },
      imageUrl: { default: "" },
      href: { default: "" },
      align: { default: "center" },
      linked: { default: true },
      width: { default: 128 },
      height: { default: 200 },
      presentation: { default: "art" },
      beta: { default: false },
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
      height: { default: 324 },
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
      height: { default: 96 },
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

export const ToyboxEmbedNode = Node.create({
  name: "toyboxEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      postId: { default: "" },
      service: { default: "" },
      align: { default: "center" },
      linked: { default: true },
      width: { default: 576 },
      height: { default: 240 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pagestorm-toybox]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pagestorm-toybox": "" })];
  },
  addKeyboardShortcuts() {
    return atomKeyboard(this.name);
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToyboxView, nodeViewOptions);
  },
});

export const PagestormLightSection = Node.create({
  name: "pagestormLightSection",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: "section[data-pagestorm-light]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-pagestorm-light": "",
        class: "light pagestorm-light-section",
      }),
      0,
    ];
  },
});

export function gameAssetAttrs(
  asset: MockGameAsset,
  options: {
    align?: MockAlign;
    presentation?: CardPresentation;
    beta?: boolean;
    linked?: boolean;
  } = {},
) {
  const presentation = options.presentation ?? "art";
  const width = presentation === "tiny" ? 72 : defaultAssetWidth(asset.kind);
  return {
    assetId: asset.id,
    kind: asset.kind,
    entityType: asset.kind,
    name: asset.name,
    imageUrl: asset.imageUrl,
    href: asset.href,
    align: options.align ?? "center",
    linked: options.linked ?? true,
    width,
    height: asset.kind === "card" && presentation !== "tiny" ? Math.round(width * 1.56) : width,
    presentation,
    beta: options.beta ?? false,
  };
}

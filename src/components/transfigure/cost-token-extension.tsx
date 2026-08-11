"use client";

import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import type { NodeType } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import Image from "@/components/ui/static-image";

export type CostTokenKind = "energy" | "star";

export type CostTokenOptions = {
  energyIconSrc: string;
  starIconSrc: string;
};

const DEFAULT_STAR_ICON = "/images/game-assets/card-misc/star_icon.png";
const DEFAULT_ENERGY_ICON = "/images/game-assets/card-misc/energy_colorless.png";

function CostTokenNodeView({ node, extension }: NodeViewProps) {
  const kind = (node.attrs.kind as CostTokenKind) || "energy";
  const count = Math.max(1, Math.floor(Number(node.attrs.count) || 1));
  const src = kind === "star"
    ? (extension.options.starIconSrc as string)
    : (extension.options.energyIconSrc as string);
  const alt = kind === "star" ? "star" : "energy";

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-baseline gap-0 align-text-bottom"
      data-cost-token={kind}
      data-count={count}
      contentEditable={false}
    >
      {Array.from({ length: count }, (_, index) => (
        <Image
          key={index}
          src={src}
          alt={alt}
          width={14}
          height={14}
          className="mx-[0.05em] inline-block align-text-bottom"
          style={{ width: "1em", height: "1em" }}
        />
      ))}
    </NodeViewWrapper>
  );
}

function insertOrGrowCostToken(
  type: NodeType,
  kind: CostTokenKind,
  range: { from: number; to: number },
  state: EditorState,
): Transaction {
  const tr = state.tr;
  const $from = state.doc.resolve(range.from);
  const before = $from.nodeBefore;
  if (
    before
    && before.type === type
    && before.attrs.kind === kind
  ) {
    const pos = range.from - before.nodeSize;
    tr.setNodeMarkup(pos, undefined, {
      kind,
      count: Math.max(1, Number(before.attrs.count) || 1) + 1,
    });
    tr.delete(range.from, range.to);
    return tr;
  }
  return tr.replaceWith(range.from, range.to, type.create({ kind, count: 1 }));
}

/**
 * Inline atom for STS2 in-description energy / Regent star icons.
 * Enabled only when RichContentEditor opts in (Transfigure).
 */
export const CostTokenExtension = Node.create<CostTokenOptions>({
  name: "cost-token",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      energyIconSrc: DEFAULT_ENERGY_ICON,
      starIconSrc: DEFAULT_STAR_ICON,
    };
  },

  addAttributes() {
    return {
      kind: { default: "energy" },
      count: { default: 1 },
    };
  },

  parseHTML() {
    return [{
      tag: "span[data-cost-token]",
      getAttrs: (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const kind = element.getAttribute("data-cost-token");
        if (kind !== "energy" && kind !== "star") return false;
        const count = Number(element.getAttribute("data-count") || "1");
        return { kind, count: Number.isFinite(count) && count > 0 ? count : 1 };
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = (node.attrs.kind as CostTokenKind) || "energy";
    const count = Math.max(1, Math.floor(Number(node.attrs.count) || 1));
    const text = kind === "energy" ? "@".repeat(count) : "*".repeat(count);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-cost-token": kind,
        "data-count": String(count),
        class: "inline-flex items-baseline align-text-bottom",
      }),
      text,
    ];
  },

  renderText({ node }) {
    const kind = (node.attrs.kind as CostTokenKind) || "energy";
    const count = Math.max(1, Math.floor(Number(node.attrs.count) || 1));
    return kind === "energy" ? "@".repeat(count) : "*".repeat(count);
  },

  addNodeView() {
    return ReactNodeViewRenderer(CostTokenNodeView, { as: "span" });
  },

  addInputRules() {
    return [
      new InputRule({
        find: /@$/,
        handler: ({ state, range }) => {
          insertOrGrowCostToken(this.type, "energy", range, state);
        },
      }),
      new InputRule({
        find: /\*$/,
        handler: ({ state, range }) => {
          insertOrGrowCostToken(this.type, "star", range, state);
        },
      }),
    ];
  },
});

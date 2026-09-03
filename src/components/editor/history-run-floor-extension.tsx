"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { HistoryRunFloorChip } from "@/components/history-course/history-run-floor-chip";
import type { HistoryRunFloorBlock } from "@/lib/chemical-types";
import {
  historyRunFloorPlainText,
  isHistoryRunFloorBlock,
} from "@/lib/history-run-floor";

function numberAttr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function blockFromNode(node: NodeViewProps["node"]): HistoryRunFloorBlock | null {
  const candidate = {
    type: "history-run-floor" as const,
    floor: numberAttr(node.attrs.floor, 0),
    actIndex: numberAttr(node.attrs.actIndex, -1),
    step: numberAttr(node.attrs.step, 0),
    mapPointType: typeof node.attrs.mapPointType === "string" ? node.attrs.mapPointType : "unknown",
    spriteSrc: typeof node.attrs.spriteSrc === "string" ? node.attrs.spriteSrc : "",
  };
  return isHistoryRunFloorBlock(candidate) ? candidate : null;
}

function HistoryRunFloorNodeView({ node }: NodeViewProps) {
  const block = blockFromNode(node);
  if (!block) return null;

  return (
    <NodeViewWrapper as="span" className="mx-0.5 inline-flex align-baseline" data-history-run-floor="">
      <HistoryRunFloorChip block={block} />
    </NodeViewWrapper>
  );
}

export const HistoryRunFloorExtension = Node.create({
  name: "history-run-floor",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      floor: { default: 1 },
      actIndex: { default: 0 },
      step: { default: 1 },
      mapPointType: { default: "unknown" },
      spriteSrc: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-history-run-floor]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const block = blockFromNode(node);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-history-run-floor": "",
        "data-floor": String(node.attrs.floor ?? ""),
        "data-act-index": String(node.attrs.actIndex ?? ""),
        "data-step": String(node.attrs.step ?? ""),
        "data-map-point-type": String(node.attrs.mapPointType ?? ""),
        "data-sprite-src": String(node.attrs.spriteSrc ?? ""),
        class: "font-semibold text-amber-100",
      }),
      block ? historyRunFloorPlainText(block, "ko") : "",
    ];
  },

  renderText({ node }) {
    const block = blockFromNode(node);
    return block ? historyRunFloorPlainText(block, "ko") : "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(HistoryRunFloorNodeView, { as: "span" });
  },
});

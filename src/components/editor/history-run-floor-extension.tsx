"use client";

import { Node, mergeAttributes, type Editor } from "@tiptap/core";
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

export function replaceExclusiveHistoryFloor(
  editor: Editor,
  block: HistoryRunFloorBlock,
  replaceRange?: { from: number; to: number },
) {
  const type = editor.schema.nodes["history-run-floor"];
  if (!type) return;

  const { state } = editor;
  const tr = state.tr;
  const deletions: Array<{ from: number; to: number }> = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === "history-run-floor") {
      deletions.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  for (const range of [...deletions].sort((left, right) => right.from - left.from)) {
    tr.delete(range.from, range.to);
  }

  const from = replaceRange
    ? tr.mapping.map(replaceRange.from)
    : tr.mapping.map(state.selection.from);
  const to = replaceRange
    ? tr.mapping.map(replaceRange.to)
    : tr.mapping.map(state.selection.to);
  if (to > from) tr.delete(from, to);

  const insertPos = from;
  const $insert = tr.doc.resolve(insertPos);
  const textBefore = $insert.parent.textBetween(
    Math.max(0, $insert.parentOffset - 1),
    $insert.parentOffset,
    undefined,
    "\uFFFC",
  );
  const nodes = [];
  if (textBefore.length > 0 && !/\s/.test(textBefore)) {
    nodes.push(state.schema.text(" "));
  }
  nodes.push(type.create({
    floor: block.floor,
    actIndex: block.actIndex,
    step: block.step,
    mapPointType: block.mapPointType,
    spriteSrc: block.spriteSrc ?? "",
  }));
  nodes.push(state.schema.text(" "));
  tr.insert(insertPos, nodes);
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
}

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

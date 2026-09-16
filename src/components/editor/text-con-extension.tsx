"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { TextConChip } from "@/components/text-con/text-con-chip";
import { cn } from "@/lib/utils";

function TextConNodeView({ node, selected }: NodeViewProps) {
  const text = String(node.attrs.text || "");
  const bgColor = String(node.attrs.bgColor || "gold");
  const textColor = String(node.attrs.textColor || "dark");

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "mx-1 my-1 inline-block align-middle select-none transition-shadow",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl" : "",
      )}
      contentEditable={false}
      data-text-con-node=""
    >
      <TextConChip
        text={text}
        bgColor={bgColor}
        textColor={textColor}
        size="md"
      />
    </NodeViewWrapper>
  );
}

export const TextConExtension = Node.create({
  name: "text-con",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      text: { default: "" },
      bgColor: { default: "gold" },
      textColor: { default: "dark" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-text-con-node]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-text-con-node": "",
        "data-text": String(node.attrs.text ?? ""),
        "data-bg-color": String(node.attrs.bgColor ?? ""),
        "data-text-color": String(node.attrs.textColor ?? ""),
      }),
      String(node.attrs.text ?? ""),
    ];
  },

  renderText({ node }) {
    return String(node.attrs.text ?? "");
  },

  addNodeView() {
    return ReactNodeViewRenderer(TextConNodeView, { as: "span" });
  },
});

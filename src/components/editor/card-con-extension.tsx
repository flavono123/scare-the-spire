"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { CardConTile } from "@/components/card-con/card-con-tile";
import { useEntityMap } from "@/components/chemicalx/entity-context";
import { cn } from "@/lib/utils";

function CardConNodeView({ node, selected }: NodeViewProps) {
  const entityMap = useEntityMap();
  const cardId = String(node.attrs.cardId || "");
  const displayText = String(node.attrs.displayText || "");
  const entity = entityMap.get(`card:${cardId}`);

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "mx-1 my-1 inline-block align-middle select-none",
        selected ? "rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      )}
      contentEditable={false}
      data-card-con-node=""
    >
      <CardConTile
        card={entity?.cardData ?? null}
        displayText={displayText}
      />
    </NodeViewWrapper>
  );
}

export const CardConExtension = Node.create({
  name: "card-con",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      cardId: { default: "" },
      displayText: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-card-con-node]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-card-con-node": "",
        "data-card-id": String(node.attrs.cardId ?? ""),
        "data-display-text": String(node.attrs.displayText ?? ""),
      }),
      String(node.attrs.displayText ?? ""),
    ];
  },

  renderText({ node }) {
    return String(node.attrs.displayText ?? "");
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardConNodeView, { as: "span" });
  },
});

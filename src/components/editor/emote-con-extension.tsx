"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { EmoteGlyph } from "@/components/emote-con/emote-glyph";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { emotePlainText } from "@/lib/emote-con";
import { cn } from "@/lib/utils";

function EmoteConNodeView({ node, selected }: NodeViewProps) {
  const serviceLocale = useServiceLocale();
  const emoteId = String(node.attrs.emoteId || "");

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "mx-0.5 inline-block align-middle select-none",
        selected ? "rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      )}
      contentEditable={false}
      data-emote-con-node=""
    >
      <EmoteGlyph emoteId={emoteId} locale={serviceLocale === "en" ? "en" : "ko"} />
    </NodeViewWrapper>
  );
}

export const EmoteConExtension = Node.create({
  name: "emote-con",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      emoteId: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-emote-con-node]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const emoteId = String(node.attrs.emoteId ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-emote-con-node": "",
        "data-emote-id": emoteId,
      }),
      emotePlainText(emoteId),
    ];
  },

  renderText({ node }) {
    return emotePlainText(String(node.attrs.emoteId ?? ""));
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmoteConNodeView, { as: "span" });
  },
});

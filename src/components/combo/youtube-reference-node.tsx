"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { LoaderCircle, Youtube } from "lucide-react";

function YouTubeReferenceNodeView({ node }: NodeViewProps) {
  const title = (node.attrs.title as string) || (node.attrs.pendingLabel as string);
  const pending = !(node.attrs.title as string);

  return (
    <NodeViewWrapper
      as="span"
      className="mx-0.5 inline-flex max-w-full items-center gap-1 align-baseline font-semibold spire-aqua"
      data-youtube-reference=""
    >
      {pending ? (
        <LoaderCircle
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <Youtube aria-hidden className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">{title}</span>
    </NodeViewWrapper>
  );
}

export const YouTubeReferenceNode = Node.create({
  name: "youtube-reference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      videoId: { default: "" },
      title: { default: "" },
      pendingLabel: { default: "YouTube" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-youtube-reference]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-youtube-reference": "",
        class: "spire-aqua font-semibold",
      }),
      (node.attrs.title || node.attrs.pendingLabel) as string,
    ];
  },

  renderText({ node }) {
    return (node.attrs.title || node.attrs.pendingLabel) as string;
  },

  addNodeView() {
    return ReactNodeViewRenderer(YouTubeReferenceNodeView, { as: "span" });
  },
});

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { KeywordNodeView } from "./keyword-node-view";

/**
 * Custom keyword node: gold inline atom with hover tooltip.
 * Detection logic is in the editor's onUpdate callback, not here —
 * ProseMirror-level plugins fail with Korean IME composition.
 */
export const CustomKeyword = Node.create({
  name: "custom-keyword",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      text: { default: "" },
      description: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-custom-keyword]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-custom-keyword": "",
        class: "spire-gold font-semibold",
      }),
      0,
    ];
  },

  renderText({ node }) {
    return node.attrs.text as string;
  },

  addNodeView() {
    return ReactNodeViewRenderer(KeywordNodeView, { as: "span" });
  },
});

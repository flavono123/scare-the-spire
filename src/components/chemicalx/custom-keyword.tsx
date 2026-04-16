import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { KeywordNodeView } from "./keyword-node-view";

/**
 * Custom keyword node: user types `키워드{설명}` and on closing `}`
 * it converts to a gold inline atom with hover tooltip.
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

  addInputRules() {
    return [
      new InputRule({
        // Match non-space keyword + {description} at end of input
        find: /(\S+)\{([^}]+)\}$/,
        handler: ({ state, range, match }) => {
          const attrs = { text: match[1], description: match[2] };
          const node = this.type.create(attrs);
          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});

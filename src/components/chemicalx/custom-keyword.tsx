import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { KeywordNodeView } from "./keyword-node-view";

const KEYWORD_PATTERN = /(\S+)\{([^}]+)\}/;

/**
 * Custom keyword node: user types `키워드{설명}` and it auto-converts
 * to a gold inline atom with hover tooltip.
 *
 * Uses appendTransaction to scan document after every change —
 * immune to Korean IME, autocomplete, and paste edge cases.
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

  addProseMirrorPlugins() {
    const nodeType = this.type;

    return [
      new Plugin({
        key: new PluginKey("custom-keyword-scan"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          let tr = newState.tr;
          let replaced = false;

          newState.doc.descendants((node, pos) => {
            if (replaced) return false;
            if (!node.isText || !node.text) return;

            const match = node.text.match(KEYWORD_PATTERN);
            if (!match || match.index == null) return;

            const from = pos + match.index;
            const to = from + match[0].length;
            tr.replaceWith(from, to, nodeType.create({
              text: match[1],
              description: match[2],
            }));
            replaced = true;
            return false;
          });

          return replaced ? tr : null;
        },
      }),
    ];
  },
});

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { KeywordNodeView } from "./keyword-node-view";

const KEYWORD_PATTERN = /(\S+)\{([^}]+)\}$/;

/**
 * Custom keyword node: user types `키워드{설명}` and on closing `}`
 * it converts to a gold inline atom with hover tooltip.
 *
 * Uses handleTextInput plugin instead of InputRule to avoid conflicts
 * with the entity autocomplete suggestion system and Korean IME.
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
        key: new PluginKey("custom-keyword-input"),
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== "}") return false;

            const { state } = view;
            const $pos = state.doc.resolve(from);
            // Get all text in the current paragraph up to cursor, plus the "}" being typed
            const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, undefined, "\ufffc") + "}";

            const match = textBefore.match(KEYWORD_PATTERN);
            if (!match) return false;

            const keyword = match[1];
            const description = match[2];
            const fullMatchLen = match[0].length;

            // Calculate document positions
            const paragraphStart = $pos.start();
            const matchFrom = paragraphStart + textBefore.length - fullMatchLen;
            const matchTo = from; // cursor position before "}" is typed

            const tr = state.tr;
            // Delete the matched text range and the "}" that would be inserted
            tr.delete(matchFrom, matchTo);
            // Insert the custom keyword node at the match start
            tr.insert(matchFrom, nodeType.create({ text: keyword, description }));
            view.dispatch(tr);
            return true; // prevent default "}" insertion
          },
        },
      }),
    ];
  },
});

import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { SuggestionMatch } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { MentionNodeView } from "./mention-node-view";

export const entityMentionSuggestionPluginKey = new PluginKey(
  "entity-mention-suggestion",
);

/**
 * Entity mentions are inserted from pickers, not from typing. Keyword
 * suggestions open only on `{` via BraceKeywordSuggestion.
 */
function findSuggestionMatch(): SuggestionMatch | null {
  return null;
}

/**
 * Extended Mention node with entityType and entityId attrs.
 * Typing does not open a suggestion popup.
 */
export const EntityMention = Mention.extend({
  name: "entity-mention",

  addAttributes() {
    return {
      ...this.parent?.(),
      entityType: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-entity-type"),
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-entity-type": attrs.entityType,
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionNodeView, { as: "span" });
  },
}).configure({
  deleteTriggerWithBackspace: true,
  renderText: ({ node }) => (node.attrs.label ?? node.attrs.id ?? "") as string,
  renderHTML: ({ options, node }) => [
    "span",
    options.HTMLAttributes,
    (node.attrs.label ?? node.attrs.id ?? "") as string,
  ],
});

/**
 * Disable TipTap Mention's default `@` trigger without matching plain words.
 */
export const entitySuggestionBase = {
  pluginKey: entityMentionSuggestionPluginKey,
  char: "",
  findSuggestionMatch,
};

import Mention from "@tiptap/extension-mention";
import type { SuggestionMatch } from "@tiptap/suggestion";
import type { ResolvedPos } from "@tiptap/pm/model";

/**
 * Custom findSuggestionMatch: detects the current word (2+ chars) being typed
 * without requiring a trigger character like @.
 */
function findSuggestionMatch(config: {
  char: string;
  allowSpaces: boolean;
  allowedPrefixes: string[] | null;
  startOfLine: boolean;
  $position: ResolvedPos;
}): SuggestionMatch | null {
  const { $position } = config;
  const nodeBefore = $position.nodeBefore;

  // Only match within text nodes
  if (!nodeBefore?.isText) return null;

  const text = nodeBefore.text ?? "";

  // Find the last non-space word at the end of the text (trigger from 1 char, including jamo)
  const match = text.match(/(\S+)$/);
  if (!match) return null;

  const query = match[1];

  return {
    range: {
      from: $position.pos - query.length,
      to: $position.pos,
    },
    query,
    text: query,
  };
}

/**
 * Extended Mention node with entityType and entityId attrs.
 * Uses no-trigger-char suggestion matching.
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
});

/**
 * Default suggestion config override with custom findSuggestionMatch.
 * The `items` and `render` must be provided by the consumer.
 */
export const entitySuggestionBase = {
  char: "\0", // placeholder, overridden by findSuggestionMatch
  findSuggestionMatch,
};

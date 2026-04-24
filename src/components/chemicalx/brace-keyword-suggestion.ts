import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionMatch, SuggestionOptions } from "@tiptap/suggestion";
import type { ResolvedPos } from "@tiptap/pm/model";

/**
 * Detect the current `<displayText>{<query>` being typed (brace still open,
 * no closing `}` yet). The range covers the displayText + `{` + query so the
 * commit handler can replace the whole thing with a custom-keyword node.
 */
function findBraceKeywordMatch(config: {
  $position: ResolvedPos;
}): SuggestionMatch | null {
  const { $position } = config;
  const nodeBefore = $position.nodeBefore;
  if (!nodeBefore?.isText) return null;
  const text = nodeBefore.text ?? "";

  const m = text.match(/(\S+)\{([^{}\n]*)$/);
  if (!m) return null;

  const full = m[0] ?? "";
  const query = (m[2] ?? "").trim();

  return {
    range: {
      from: $position.pos - full.length,
      to: $position.pos,
    },
    query,
    text: full,
  };
}

/**
 * Suggestion plugin that opens a popup when the author types
 * `<displayText>{` — allowing them to pick which entity (card vs power etc.)
 * should resolve the keyword when the pattern is ambiguous. Selecting from
 * the popup (or typing `}`) commits the node with the selected type.
 */
export const BraceKeywordSuggestion = Extension.create<{
  suggestion: Omit<SuggestionOptions, "editor">;
}>({
  name: "brace-keyword-suggestion",
  addOptions() {
    return {
      suggestion: {
        char: "\0",
        allowSpaces: true,
        findSuggestionMatch: findBraceKeywordMatch,
        items: () => [],
        render: () => ({}),
        command: () => undefined,
      } as Omit<SuggestionOptions, "editor">,
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export { findBraceKeywordMatch };

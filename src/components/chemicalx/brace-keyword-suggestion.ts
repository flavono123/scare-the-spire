import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionMatch, SuggestionOptions } from "@tiptap/suggestion";
import type { ResolvedPos } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import { matchOpenBraceKeyword } from "@/lib/rich-keyword-plain-text";

export const braceKeywordSuggestionPluginKey = new PluginKey(
  "brace-keyword-suggestion",
);

/**
 * Detect `{<query>` or `<displayText>{<query>` while the brace is still open.
 * The range covers the optional display text + `{` + query so the commit
 * handler can replace the whole thing with a custom-keyword node.
 */
function findBraceKeywordMatch(config: {
  $position: ResolvedPos;
}): SuggestionMatch | null {
  const { $position } = config;
  const nodeBefore = $position.nodeBefore;
  if (!nodeBefore?.isText) return null;
  const match = matchOpenBraceKeyword(nodeBefore.text ?? "");
  if (!match) return null;

  return {
    range: {
      from: $position.pos - match.full.length,
      to: $position.pos,
    },
    query: match.query,
    text: match.full,
  };
}

/**
 * Suggestion plugin that opens a popup when the author types `{query` or
 * `<displayText>{query` — allowing them to pick which entity (card vs power
 * etc.) should resolve the keyword when the pattern is ambiguous. Selecting
 * from the popup (or typing `}`) commits the node with the selected type.
 */
export const BraceKeywordSuggestion = Extension.create<{
  suggestion: Omit<SuggestionOptions, "editor">;
}>({
  name: "brace-keyword-suggestion",
  addOptions() {
    return {
      suggestion: {
        pluginKey: braceKeywordSuggestionPluginKey,
        char: "",
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

/**
 * `{query` with the brace still open. Used by 서류 작성기 so suggestion does
 * not fire on plain typing.
 */
export function findBracePortraitMatch(config: {
  $position: ResolvedPos;
}): SuggestionMatch | null {
  const { $position } = config;
  const nodeBefore = $position.nodeBefore;
  if (!nodeBefore?.isText) return null;
  const text = nodeBefore.text ?? "";
  const match = text.match(/\{([^{}\n]*)$/);
  if (!match) return null;
  return {
    range: {
      from: $position.pos - match[0].length,
      to: $position.pos,
    },
    query: match[1] ?? "",
    text: match[0],
  };
}

export { findBraceKeywordMatch };

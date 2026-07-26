import { Extension } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionMatch, SuggestionOptions } from "@tiptap/suggestion";

function findSlashCommandMatch(config: {
  $position: ResolvedPos;
}): SuggestionMatch | null {
  const nodeBefore = config.$position.nodeBefore;
  if (!nodeBefore?.isText) return null;

  const text = nodeBefore.text ?? "";
  const match = text.match(/(?:^|\s)(\/([^\s/]*))$/);
  if (!match) return null;

  const commandText = match[1] ?? "";
  return {
    range: {
      from: config.$position.pos - commandText.length,
      to: config.$position.pos,
    },
    query: match[2] ?? "",
    text: commandText,
  };
}

export const SlashCommandSuggestion = Extension.create<{
  suggestion: Omit<SuggestionOptions, "editor">;
}>({
  name: "slash-command-suggestion",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        allowSpaces: false,
        findSuggestionMatch: findSlashCommandMatch,
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

export { findSlashCommandMatch };

import { Extension } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionMatch, SuggestionOptions } from "@tiptap/suggestion";

const floorHashPluginKey = new PluginKey("history-floor-hash-suggestion");

function findFloorHashMatch(config: {
  $position: ResolvedPos;
}): SuggestionMatch | null {
  const nodeBefore = config.$position.nodeBefore;
  if (!nodeBefore?.isText) return null;

  const text = nodeBefore.text ?? "";
  const match = text.match(/(?:^|\s)(#(\d*))$/);
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

export const FloorHashSuggestion = Extension.create<{
  suggestion: Omit<SuggestionOptions, "editor">;
}>({
  name: "history-floor-hash-suggestion",

  addOptions() {
    return {
      suggestion: {
        pluginKey: floorHashPluginKey,
        char: "#",
        allowSpaces: false,
        findSuggestionMatch: findFloorHashMatch,
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

export { findFloorHashMatch, floorHashPluginKey };

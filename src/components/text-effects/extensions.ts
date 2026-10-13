import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import {
  PagestormColor,
  PagestormJitter,
  PagestormSine,
} from "@/components/pagestorm/color-marks";

const EFFECT_MARK_NAMES = new Set(["pagestormColor", "sine", "jitter"]);

/** Typing at a caret does not keep a color, sine, or jitter mark armed. */
export const TextEffectSelectionOnly = Extension.create({
  name: "textEffectSelectionOnly",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(_transactions, _oldState, state) {
          if (!state.selection.empty || !state.storedMarks?.length) return null;
          const storedMarks = state.storedMarks.filter(
            (mark) => !EFFECT_MARK_NAMES.has(mark.type.name),
          );
          if (storedMarks.length === state.storedMarks.length) return null;
          return state.tr.setStoredMarks(storedMarks.length > 0 ? storedMarks : null);
        },
      }),
    ];
  },
});

export const TransfigureColor = PagestormColor.extend({ inclusive: false });
export const TransfigureSine = PagestormSine.extend({ inclusive: false });
export const TransfigureJitter = PagestormJitter.extend({ inclusive: false });

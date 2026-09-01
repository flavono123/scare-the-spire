import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  CHARACTER_TIER_COLOR_KEYS,
  SPIRE_TIER_COLOR_KEYS,
  type CharacterTierColorKey,
  type SpireTierColorKey,
} from "@/lib/decisions-decisions";

export const PAGESTORM_SPIRE_COLOR_KEYS = SPIRE_TIER_COLOR_KEYS;
export const PAGESTORM_CHARACTER_COLOR_KEYS = CHARACTER_TIER_COLOR_KEYS;

export type PagestormColorKey =
  | `spire-${SpireTierColorKey}`
  | `character-${CharacterTierColorKey}`;

function colorClass(key: string): string {
  return key;
}

export const PagestormColor = Mark.create({
  name: "pagestormColor",
  addAttributes() {
    return {
      colorKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-pagestorm-color"),
        renderHTML: (attrs) => {
          if (!attrs.colorKey) return {};
          return {
            "data-pagestorm-color": attrs.colorKey,
            class: colorClass(String(attrs.colorKey)),
          };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-pagestorm-color]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

export const PagestormSine = Mark.create({
  name: "sine",
  parseHTML() {
    return [{ tag: "span.rich-sine" }];
  },
  renderHTML() {
    return ["span", { class: "rich-sine" }, 0];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.marks.some((mark) => mark.type.name === "sine")) {
                return;
              }
              const text = node.text ?? "";
              let offset = 0;
              let index = 0;
              while (offset < text.length) {
                const code = text.codePointAt(offset) ?? 0;
                const len = code > 0xffff ? 2 : 1;
                decorations.push(
                  Decoration.inline(pos + offset, pos + offset + len, {
                    class: "rich-sine-letter",
                    style: `--rich-sine-index: ${index}`,
                  }),
                );
                offset += len;
                index += 1;
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export const PagestormJitter = Mark.create({
  name: "jitter",
  parseHTML() {
    return [{ tag: "span.rich-jitter" }];
  },
  renderHTML() {
    return ["span", { class: "rich-jitter" }, 0];
  },
});

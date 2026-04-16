"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityMention, entitySuggestionBase } from "./entity-mention";
import { CustomKeyword } from "./custom-keyword";
import { MentionList, type MentionListRef } from "./mention-list";
import { EntityMapProvider } from "./entity-context";
import { buildEntityMap } from "./post-renderer";
import { tiptapToBlocks, blocksToPlainText, matchEntities } from "@/lib/chemical-utils";
import type { JSONContent } from "@tiptap/react";

const KEYWORD_RE = /(\S+)\{([^}]+)\}/;

/**
 * Walk TipTap JSON, find text nodes matching keyword{description},
 * split them into [before, custom-keyword-node, after].
 * Mutates the JSON in place. Returns true if any replacement was made.
 */
function replaceKeywordsInJSON(doc: JSONContent): boolean {
  let replaced = false;

  function walk(node: JSONContent) {
    if (!node.content) return;
    const newContent: JSONContent[] = [];

    for (const child of node.content) {
      if (child.type === "text" && child.text) {
        const m = child.text.match(KEYWORD_RE);
        if (m && m.index != null) {
          replaced = true;
          const before = child.text.slice(0, m.index);
          const after = child.text.slice(m.index + m[0].length);
          if (before) newContent.push({ type: "text", text: before });
          newContent.push({
            type: "custom-keyword",
            attrs: { text: m[1], description: m[2] },
          });
          if (after) newContent.push({ type: "text", text: after });
          continue;
        }
      }
      walk(child);
      newContent.push(child);
    }

    node.content = newContent;
  }

  walk(doc);
  return replaced;
}

const MAX_CHARS = 30;
const MIN_CHARS = 2;
const DEFAULT_NICKNAME = "익명의 투입터리안";
const NICKNAME_KEY = "sts-chemicalx-nickname";

function getSavedNickname(): string {
  if (typeof window === "undefined") return DEFAULT_NICKNAME;
  return localStorage.getItem(NICKNAME_KEY) || DEFAULT_NICKNAME;
}

const PLACEHOLDER = "오, 이 차는 무례한 사람들에게 내어지는 차입니다...";
const DRAFT_KEY = "sts-chemicalx-draft";

function getSavedDraft(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(DRAFT_KEY);
}

function saveDraft(json: string) {
  sessionStorage.setItem(DRAFT_KEY, json);
}

function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY);
}

interface ChemicalXEditorProps {
  entities: EntityInfo[];
  onSubmit: (blocks: ReturnType<typeof tiptapToBlocks>, nickname: string) => Promise<void>;
}

export function ChemicalXEditor({ entities, onSubmit }: ChemicalXEditorProps) {
  const [nickname, setNickname] = useState(getSavedNickname);
  const [submitting, setSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(() => {
    const draft = getSavedDraft();
    if (draft) try { return blocksToPlainText(tiptapToBlocks(JSON.parse(draft))).length; } catch { /* ignore */ }
    return 0;
  });
  const popupRef = useRef<HTMLDivElement | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const suggestionOpenRef = useRef(false);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const editor = useEditor({
    immediatelyRender: false,
    content: (() => {
      const draft = getSavedDraft();
      if (draft) try { return JSON.parse(draft); } catch { /* ignore */ }
      return undefined;
    })(),
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Placeholder.configure({ placeholder: PLACEHOLDER }),
      CharacterCount.configure({ limit: MAX_CHARS }),
      CustomKeyword,
      EntityMention.configure({
        HTMLAttributes: {
          class: "spire-gold font-semibold",
        },
        suggestion: {
          ...entitySuggestionBase,
          items: ({ query }: { query: string }) => matchEntities(query, entities),
          render: () => {
            let renderer: ReactRenderer<MentionListRef> | null = null;
            let popup: HTMLDivElement | null = null;

            return {
              onStart: (props: SuggestionProps) => {
                suggestionOpenRef.current = true;
                renderer = new ReactRenderer(MentionList, {
                  props: {
                    items: props.items,
                    command: (item: EntityInfo) => {
                      props.command({
                        id: item.id,
                        label: item.nameKo,
                        entityType: item.type,
                      });
                    },
                  },
                  editor: props.editor,
                });

                popup = document.createElement("div");
                popup.style.position = "fixed";
                popup.style.zIndex = "100";
                popup.appendChild(renderer.element);
                document.body.appendChild(popup);

                if (props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    popup.style.left = `${rect.left}px`;
                    popup.style.top = `${rect.bottom + 4}px`;
                  }
                }
              },

              onUpdate: (props: SuggestionProps) => {
                renderer?.updateProps({
                  items: props.items,
                  command: (item: EntityInfo) => {
                    props.command({
                      id: item.id,
                      label: item.nameKo,
                      entityType: item.type,
                    });
                  },
                });

                if (popup && props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    popup.style.left = `${rect.left}px`;
                    popup.style.top = `${rect.bottom + 4}px`;
                  }
                }
              },

              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === "Escape") {
                  suggestionOpenRef.current = false;
                  popup?.remove();
                  renderer?.destroy();
                  popup = null;
                  renderer = null;
                  return true;
                }
                return renderer?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                suggestionOpenRef.current = false;
                popup?.remove();
                renderer?.destroy();
                popup = null;
                renderer = null;
              },
            };
          },
        },
      }),
    ],
    onUpdate: ({ editor }) => {
      // Skip keyword detection during IME composition (Korean input)
      if (editor.view.composing) {
        return;
      }

      // Scan for custom keyword pattern in editor JSON: keyword{description}
      const json = editor.getJSON();
      const replaced = replaceKeywordsInJSON(json);

      if (replaced) {
        // Re-set content with keywords replaced — triggers another onUpdate
        const cursorPos = editor.state.selection.from;
        editor.commands.setContent(json);
        // Restore cursor near where it was (may shift slightly)
        try {
          const maxPos = editor.state.doc.content.size;
          editor.commands.focus();
          editor.commands.setTextSelection(Math.min(cursorPos, maxPos));
        } catch { /* cursor restore is best-effort */ }
        return;
      }

      const blocks = tiptapToBlocks(json);
      const len = blocksToPlainText(blocks).length;
      setCharCount(len);
      if (len > 0) saveDraft(JSON.stringify(json));
      else clearDraft();
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[2.5rem] px-3 py-2 text-sm text-gray-200 outline-none",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          if (suggestionOpenRef.current) {
            // Let suggestion plugin handle Enter for item selection
            return false;
          }
          // Popup closed: submit
          submitRef.current();
          return true;
        }
        return false;
      },
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!editor || submitting) return;
    const blocks = tiptapToBlocks(editor.getJSON());
    const text = blocksToPlainText(blocks);
    const nick = nickname.trim() || DEFAULT_NICKNAME;

    if (text.length < MIN_CHARS || text.length > MAX_CHARS) return;

    setSubmitting(true);
    localStorage.setItem(NICKNAME_KEY, nick);

    try {
      await onSubmit(blocks, nick);
      editor.commands.clearContent();
      setCharCount(0);
      clearDraft();
    } finally {
      setSubmitting(false);
    }
  }, [editor, nickname, submitting, onSubmit]);

  // Keep ref in sync for use inside ProseMirror handleKeyDown
  submitRef.current = handleSubmit;

  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

  const charCountColor = useMemo(() => {
    if (charCount === 0) return "text-gray-500";
    if (charCount < MIN_CHARS) return "text-red-400";
    if (charCount > MAX_CHARS) return "text-red-400";
    if (charCount >= MAX_CHARS - 5) return "text-yellow-400";
    return "text-gray-400";
  }, [charCount]);

  return (
    <div className="border border-border rounded-lg bg-card/30 overflow-visible">
      {/* Nickname */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={DEFAULT_NICKNAME}
          maxLength={20}
          className="bg-transparent text-sm text-gray-300 placeholder:text-gray-600 outline-none w-full"
        />
      </div>

      {/* Editor — overflow-visible so entity tooltips are not clipped */}
      <div ref={popupRef} className="overflow-visible relative">
        <EntityMapProvider value={entityMap}>
          <EditorContent editor={editor} />
        </EntityMapProvider>
      </div>

      {/* Footer: char count + submit */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <span className={`text-xs font-mono ${charCountColor}`}>
          {charCount}/{MAX_CHARS}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "..." : "투입"}
          <Image
            src="/images/relics/inserter.webp"
            alt=""
            width={14}
            height={14}
            className="object-contain"
          />
        </button>
      </div>
    </div>
  );
}

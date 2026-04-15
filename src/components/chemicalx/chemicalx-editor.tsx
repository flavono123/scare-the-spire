"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityMention, entitySuggestionBase } from "./entity-mention";
import { MentionList, type MentionListRef } from "./mention-list";
import { tiptapToBlocks, blocksToPlainText, matchEntities } from "@/lib/chemical-utils";

const MAX_CHARS = 30;
const MIN_CHARS = 2;
const NICKNAME_KEY = "sts-nickname";

function getNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICKNAME_KEY) ?? "";
}

interface ChemicalXEditorProps {
  entities: EntityInfo[];
  onSubmit: (blocks: ReturnType<typeof tiptapToBlocks>, nickname: string) => Promise<void>;
}

export function ChemicalXEditor({ entities, onSubmit }: ChemicalXEditorProps) {
  const [nickname, setNickname] = useState(getNickname);
  const [submitting, setSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level nodes - micro-blog is single paragraph
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Placeholder.configure({
        placeholder: "슬더스 이야기를 들려주세요...",
      }),
      CharacterCount.configure({ limit: MAX_CHARS }),
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
                  popup?.remove();
                  renderer?.destroy();
                  popup = null;
                  renderer = null;
                  return true;
                }
                return renderer?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
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
      const blocks = tiptapToBlocks(editor.getJSON());
      setCharCount(blocksToPlainText(blocks).length);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[2.5rem] max-h-[6rem] overflow-y-auto px-3 py-2 text-sm text-gray-200 outline-none",
      },
      handleKeyDown: (_view, event) => {
        // Block Enter from creating new paragraphs
        if (event.key === "Enter" && !event.shiftKey) {
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
    const nick = nickname.trim();

    if (text.length < MIN_CHARS || text.length > MAX_CHARS || !nick) return;

    setSubmitting(true);
    localStorage.setItem(NICKNAME_KEY, nick);

    try {
      await onSubmit(blocks, nick);
      editor.commands.clearContent();
      setCharCount(0);
    } finally {
      setSubmitting(false);
    }
  }, [editor, nickname, submitting, onSubmit]);

  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS && nickname.trim().length > 0;

  const charCountColor = useMemo(() => {
    if (charCount === 0) return "text-gray-500";
    if (charCount < MIN_CHARS) return "text-red-400";
    if (charCount > MAX_CHARS) return "text-red-400";
    if (charCount >= MAX_CHARS - 5) return "text-yellow-400";
    return "text-gray-400";
  }, [charCount]);

  return (
    <div className="border border-border rounded-lg bg-card/30">
      {/* Nickname row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임"
          maxLength={20}
          className="bg-transparent text-sm text-gray-300 placeholder:text-gray-600 outline-none w-32"
        />
      </div>

      {/* Editor */}
      <div ref={popupRef}>
        <EditorContent editor={editor} />
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
          className="px-3 py-1 text-xs font-semibold rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "..." : "투입"}
        </button>
      </div>
    </div>
  );
}

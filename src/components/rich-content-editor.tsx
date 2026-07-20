"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "@/components/ui/static-image";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { EntityMention, entitySuggestionBase } from "@/components/chemicalx/entity-mention";
import { BraceKeywordSuggestion } from "@/components/chemicalx/brace-keyword-suggestion";
import { CustomKeyword } from "@/components/chemicalx/custom-keyword";
import { MentionList, type MentionListRef } from "@/components/chemicalx/mention-list";
import { EntityMapProvider } from "@/components/chemicalx/entity-context";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";
import {
  buildEntityKeywordIndex,
  blocksToPlainText,
  entityKeywordDescription,
  matchEntities,
  normalizeKeywordLookupKey,
  resolveEntityKeyword,
  tiptapToBlocks,
} from "@/lib/chemical-utils";
import { GOLD_TERM_DESC, KEYWORD_DESC } from "@/components/codex/codex-description";
import type { PostBlock } from "@/lib/chemical-types";

// Inner body must start AND end with non-whitespace — typing `{ foo }` (with
// padding spaces) keeps the keyword in a pending, plain-text state so the
// suggestion popup can handle disambiguation. Removing the padding triggers
// the regex-based activation for unambiguous names.
const KEYWORD_RE_SOURCE = /(\S+)\{(\S(?:[^{}\n]*\S)?)\}/.source;
const KEYWORD_AT_CURSOR_RE = /(\S+)\{(\S(?:[^{}\n]*\S)?)\}$/;

function cleanTooltipText(text: string): string {
  return text
    .replace(/\[\/?\w+(?::[^/\]]+)?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeKeywordPart(text: string): string {
  return text.replace(/\uFFFC/g, "").trim();
}

interface KeywordResolution {
  keyword: string;
  description: string;
  entityId?: string;
  entityType?: EntityType;
}

function replaceKeywordAtCursor(
  editor: Editor,
  resolveKeyword: (keyword: string) => KeywordResolution,
): boolean {
  const keywordNode = editor.schema.nodes["custom-keyword"];
  if (!keywordNode) return false;

  const { from, empty, $from } = editor.state.selection;
  if (!empty) return false;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\uFFFC");
  const m = textBefore.match(KEYWORD_AT_CURSOR_RE);
  if (!m) return false;

  const text = sanitizeKeywordPart(m[1] ?? "");
  const keyword = sanitizeKeywordPart(m[2] ?? "");
  if (!text || !keyword) return false;

  const resolved = resolveKeyword(keyword);
  const start = from - m[0].length;
  const tr = editor.state.tr.replaceWith(
    start,
    from,
    keywordNode.create({
      text,
      keyword: resolved.keyword,
      description: resolved.description,
      entityId: resolved.entityId ?? "",
      entityType: resolved.entityType ?? "",
    }),
  );
  editor.view.dispatch(tr);
  return true;
}

function unwrapMalformedKeywords(editor: Editor): boolean {
  const unwraps: Array<{ from: number; to: number; text: string }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "custom-keyword") return;
    const text = (node.attrs.text as string) ?? "";
    if (!text.includes("{") && !text.includes("}")) return;
    unwraps.push({ from: pos, to: pos + node.nodeSize, text });
  });
  if (!unwraps.length) return false;

  const tr = editor.state.tr;
  for (let i = unwraps.length - 1; i >= 0; i--) {
    const { from, to, text } = unwraps[i];
    tr.replaceWith(from, to, editor.schema.text(text));
  }
  editor.view.dispatch(tr);
  return true;
}

function replaceKeywordsInEditor(
  editor: Editor,
  resolveKeyword: (keyword: string) => KeywordResolution,
): boolean {
  if (unwrapMalformedKeywords(editor)) {
    return true;
  }

  if (replaceKeywordAtCursor(editor, resolveKeyword)) {
    return true;
  }

  const keywordNode = editor.schema.nodes["custom-keyword"];
  if (!keywordNode) return false;

  const replacements: Array<{
    from: number;
    to: number;
    text: string;
    keyword: string;
    description: string;
    entityId?: string;
    entityType?: EntityType;
  }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const keywordRe = new RegExp(KEYWORD_RE_SOURCE, "g");

    for (const m of node.text.matchAll(keywordRe)) {
      if (m.index == null) continue;

      const keywordText = sanitizeKeywordPart(m[1] ?? "");
      const keyword = sanitizeKeywordPart(m[2] ?? "");
      if (!keywordText || !keyword) continue;
      const resolved = resolveKeyword(keyword);

      const from = pos + m.index;
      const to = from + m[0].length;
      replacements.push({
        from,
        to,
        text: keywordText,
        keyword: resolved.keyword,
        description: resolved.description,
        entityId: resolved.entityId,
        entityType: resolved.entityType,
      });
    }
  });

  if (!replacements.length) return false;

  const tr = editor.state.tr;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { from, to, text, keyword, description, entityId, entityType } = replacements[i];
    tr.replaceWith(from, to, keywordNode.create({
      text,
      keyword,
      description,
      entityId: entityId ?? "",
      entityType: entityType ?? "",
    }));
  }

  editor.view.dispatch(tr);
  return true;
}

function getSavedDraft(draftKey: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(draftKey);
}

function saveDraft(draftKey: string, json: string) {
  sessionStorage.setItem(draftKey, json);
}

function clearDraft(draftKey: string) {
  sessionStorage.removeItem(draftKey);
}

export interface RichContentEditorProps {
  entities: EntityInfo[];
  onSubmit: (blocks: PostBlock[]) => Promise<void>;
  placeholder: string;
  draftKey: string;
  submitLabel: string;
  minChars?: number;
  maxChars?: number | null;
  submitIconSrc?: string;
  showKeywordTip?: boolean;
  keywordTip?: {
    label: string;
    text: string;
    keyword: string;
    result: string;
  };
  entityInsertRequest?: {
    requestId: number;
    entity: EntityInfo;
  } | null;
}

export function RichContentEditor({
  entities,
  onSubmit,
  placeholder,
  draftKey,
  submitLabel,
  minChars = 2,
  maxChars = 30,
  submitIconSrc,
  showKeywordTip = false,
  keywordTip,
  entityInsertRequest,
}: RichContentEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(() => {
    const draft = getSavedDraft(draftKey);
    if (draft) {
      try {
        return blocksToPlainText(tiptapToBlocks(JSON.parse(draft))).length;
      } catch {
        return 0;
      }
    }
    return 0;
  });
  const editorRef = useRef<Editor | null>(null);
  const composeTimeoutRef = useRef<number | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const suggestionOpenRef = useRef(false);
  const lastEntityInsertRequestIdRef = useRef<number | null>(null);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const keywordEntityIndex = useMemo(() => buildEntityKeywordIndex(entities), [entities]);
  const keywordDescriptionMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const [k, v] of Object.entries(KEYWORD_DESC)) {
      map.set(normalizeKeywordLookupKey(k), cleanTooltipText(v));
    }
    for (const [k, v] of Object.entries(GOLD_TERM_DESC)) {
      map.set(normalizeKeywordLookupKey(k), cleanTooltipText(v));
    }

    return map;
  }, []);

  const resolveKeyword = useCallback((keyword: string): KeywordResolution => {
    const cleanKeyword = sanitizeKeywordPart(keyword);
    const lookupKey = normalizeKeywordLookupKey(cleanKeyword);
    const entity = resolveEntityKeyword(cleanKeyword, keywordEntityIndex);
    const entityDescription = entity ? entityKeywordDescription(entity) : null;
    const description =
      (entityDescription ? cleanTooltipText(entityDescription) : null)
      ?? keywordDescriptionMap.get(lookupKey)
      ?? cleanKeyword;
    return {
      keyword: cleanKeyword,
      description,
      entityId: entity?.id,
      entityType: entity?.type,
    };
  }, [keywordDescriptionMap, keywordEntityIndex]);

  const syncEditorState = useCallback((editor: Editor) => {
    const json = editor.getJSON();
    const blocks = tiptapToBlocks(json);
    const len = blocksToPlainText(blocks).length;
    setCharCount(len);
    if (len > 0) saveDraft(draftKey, JSON.stringify(json));
    else clearDraft(draftKey);
  }, [draftKey]);

  const processEditorUpdate = useCallback((editor: Editor) => {
    if (replaceKeywordsInEditor(editor, resolveKeyword)) {
      return;
    }
    syncEditorState(editor);
  }, [resolveKeyword, syncEditorState]);
  const processEditorUpdateRef = useRef(processEditorUpdate);
  processEditorUpdateRef.current = processEditorUpdate;

  const editor = useEditor({
    immediatelyRender: false,
    content: (() => {
      const draft = getSavedDraft(draftKey);
      if (draft) {
        try {
          return JSON.parse(draft);
        } catch {
          return undefined;
        }
      }
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
      Placeholder.configure({ placeholder }),
      CharacterCount.configure(maxChars == null ? {} : { limit: maxChars }),
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
      BraceKeywordSuggestion.configure({
        suggestion: {
          char: "\0",
          allowSpaces: true,
          items: ({ query }: { query: string }) => matchEntities(query, entities),
          command: ({ editor: ed, range, props }) => {
            const keywordNode = ed.schema.nodes["custom-keyword"];
            if (!keywordNode) return;
            const item = props as unknown as EntityInfo;
            const rangeText = ed.state.doc.textBetween(range.from, range.to);
            const braceIdx = rangeText.indexOf("{");
            const display = braceIdx > 0 ? rangeText.slice(0, braceIdx) : rangeText;
            const resolved = resolveKeyword(item.nameKo);
            ed.chain().focus()
              .insertContentAt(range, {
                type: "custom-keyword",
                attrs: {
                  text: display,
                  keyword: item.nameKo,
                  description: resolved.description,
                  entityId: item.id,
                  entityType: item.type,
                },
              })
              .run();
          },
          render: () => {
            let renderer: ReactRenderer<MentionListRef> | null = null;
            let popup: HTMLDivElement | null = null;

            const buildCommand = (props: SuggestionProps) => (item: EntityInfo) => {
              props.command({
                id: item.id,
                label: item.nameKo,
                entityType: item.type,
                type: item.type,
                nameKo: item.nameKo,
                nameEn: item.nameEn,
                color: item.color,
                imageUrl: item.imageUrl,
              } as unknown as Record<string, unknown>);
            };

            return {
              onStart: (props: SuggestionProps) => {
                suggestionOpenRef.current = true;
                renderer = new ReactRenderer(MentionList, {
                  props: {
                    items: props.items,
                    command: buildCommand(props),
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
                  command: buildCommand(props),
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
                // Treat `}` as commit: pick the currently-highlighted item
                // and prevent the literal `}` from being inserted.
                if (props.event.key === "}") {
                  const handled = renderer?.ref?.onKeyDown({
                    event: new KeyboardEvent("keydown", { key: "Enter" }),
                  });
                  return handled ?? false;
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
    onCreate: ({ editor }) => {
      editorRef.current = editor;
      processEditorUpdateRef.current(editor);
    },
    onDestroy: () => {
      editorRef.current = null;
      if (composeTimeoutRef.current != null) {
        window.clearTimeout(composeTimeoutRef.current);
        composeTimeoutRef.current = null;
      }
    },
    onUpdate: ({ editor }) => {
      if (editor.view.composing) {
        if (composeTimeoutRef.current != null) {
          window.clearTimeout(composeTimeoutRef.current);
        }
        composeTimeoutRef.current = window.setTimeout(() => {
          const currentEditor = editorRef.current;
          if (!currentEditor || currentEditor.isDestroyed || currentEditor.view.composing) {
            return;
          }
          processEditorUpdate(currentEditor);
        }, 0);
        return;
      }

      processEditorUpdate(editor);
    },
    editorProps: {
      attributes: {
        class: "min-h-[2.5rem] px-3 py-2 text-sm text-gray-200 outline-none",
      },
      handleDOMEvents: {
        compositionend: () => {
          window.setTimeout(() => {
            const currentEditor = editorRef.current;
            if (!currentEditor || currentEditor.isDestroyed || currentEditor.view.composing) {
              return;
            }
            processEditorUpdate(currentEditor);
          }, 0);
          return false;
        },
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          if (suggestionOpenRef.current) {
            return false;
          }
          submitRef.current();
          return true;
        }
        return false;
      },
    },
  }, [draftKey, entities, maxChars, placeholder]);

  useEffect(() => {
    if (
      !editor
      || !entityInsertRequest
      || lastEntityInsertRequestIdRef.current === entityInsertRequest.requestId
    ) {
      return;
    }

    const mentionNode = editor.schema.nodes["entity-mention"];
    if (!mentionNode) return;

    lastEntityInsertRequestIdRef.current = entityInsertRequest.requestId;
    const { entity } = entityInsertRequest;
    const { $from } = editor.state.selection;
    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 1),
      $from.parentOffset,
      undefined,
      "\uFFFC",
    );
    const needsLeadingSpace = textBefore.length > 0 && !/\s/.test(textBefore);

    editor.chain().focus().insertContent([
      ...(needsLeadingSpace ? [{ type: "text", text: " " }] : []),
      {
        type: "entity-mention",
        attrs: {
          id: entity.id,
          label: entity.nameKo,
          entityType: entity.type,
        },
      },
      { type: "text", text: " " },
    ]).run();
  }, [editor, entityInsertRequest]);

  const handleSubmit = useCallback(async () => {
    if (!editor || submitting) return;
    const blocks = tiptapToBlocks(editor.getJSON());
    const text = blocksToPlainText(blocks);

    if (text.length < minChars || (maxChars != null && text.length > maxChars)) return;

    setSubmitting(true);

    try {
      await onSubmit(blocks);
      editor.commands.clearContent();
      setCharCount(0);
      clearDraft(draftKey);
    } catch {
      // Keep the draft intact when the backing store is unavailable.
    } finally {
      setSubmitting(false);
    }
  }, [draftKey, editor, maxChars, minChars, onSubmit, submitting]);

  submitRef.current = handleSubmit;

  const isValid = charCount >= minChars && (maxChars == null || charCount <= maxChars);
  const charCountColor = useMemo(() => {
    if (charCount === 0) return "text-gray-500";
    if (charCount < minChars || (maxChars != null && charCount > maxChars)) return "text-red-400";
    if (maxChars != null && charCount >= maxChars - 5) return "text-yellow-400";
    return "text-gray-400";
  }, [charCount, maxChars, minChars]);

  return (
    <div className="border border-border rounded-lg bg-card/30 overflow-visible">
      <div className="overflow-visible relative">
        <EntityMapProvider value={entityMap}>
          <EditorContent editor={editor} />
        </EntityMapProvider>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 border-t border-border">
        {maxChars != null && (
          <span className={`text-xs font-mono shrink-0 ${charCountColor}`}>
            {charCount}/{maxChars}
          </span>
        )}
        {showKeywordTip && keywordTip && (
          <span className="hidden sm:block text-[11px] text-gray-500 truncate flex-1 min-w-0 opacity-70">
            {keywordTip.label} {keywordTip.text}
            {"{"}
            <span className="spire-gold">{keywordTip.keyword}</span>
            {"}"}
            {" → "}
            <span className="spire-gold">{keywordTip.result}</span>
          </span>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {submitting ? "..." : submitLabel}
          {submitIconSrc && (
            <Image
              src={submitIconSrc}
              alt=""
              width={14}
              height={14}
              className="object-contain"
            />
          )}
        </button>
      </div>
    </div>
  );
}

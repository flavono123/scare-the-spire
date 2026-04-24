"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Image from "@/components/ui/static-image";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { EntityMention, entitySuggestionBase } from "@/components/chemicalx/entity-mention";
import { CustomKeyword } from "@/components/chemicalx/custom-keyword";
import { MentionList, type MentionListRef } from "@/components/chemicalx/mention-list";
import { EntityMapProvider } from "@/components/chemicalx/entity-context";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";
import { tiptapToBlocks, blocksToPlainText, matchEntities } from "@/lib/chemical-utils";
import { GOLD_TERM_DESC, KEYWORD_DESC } from "@/components/codex/codex-description";
import type { PostBlock } from "@/lib/chemical-types";

// Inner body must start AND end with non-whitespace — typing `{ foo }` (with
// padding spaces) keeps the keyword in a pending, plain-text state so the
// author can edit/disambiguate. Removing the padding triggers activation.
const KEYWORD_RE_SOURCE = /(\S+)\{(\S(?:[^{}\n]*\S)?)\}/.source;
const KEYWORD_AT_CURSOR_RE = /(\S+)\{(\S(?:[^{}\n]*\S)?)\}$/;

// When the same display name collides across entity types (e.g. 전투의 북소리
// exists as both card and power), append `:<type>` inside the braces to pick
// one deterministically — e.g. `전북{전투의 북소리:card}`.
const TYPE_HINT_RE = /^(.+):(card|power|relic|potion|enchantment|affliction|monster|event)$/;
const TYPE_FALLBACK_PRIORITY = [
  "card", "relic", "power", "potion", "enchantment", "affliction", "monster", "event",
] as const;

function parseTypeHint(raw: string): { bare: string; hinted?: EntityType } {
  const m = raw.match(TYPE_HINT_RE);
  if (!m) return { bare: raw };
  return { bare: sanitizeKeywordPart(m[1] ?? ""), hinted: m[2] as EntityType };
}

function cleanTooltipText(text: string): string {
  return text
    .replace(/\[\/?\w+(?::[^/\]]+)?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeKeywordPart(text: string): string {
  return text.replace(/\uFFFC/g, "").trim();
}

function normalizeKeywordKey(text: string): string {
  return sanitizeKeywordPart(text).replace(/\s+/g, " ");
}

function compactKeywordKey(text: string): string {
  return normalizeKeywordKey(text).replace(/\s+/g, "");
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

interface RichContentEditorProps {
  entities: EntityInfo[];
  onSubmit: (blocks: PostBlock[]) => Promise<void>;
  placeholder: string;
  draftKey: string;
  submitLabel: string;
  minChars?: number;
  maxChars?: number;
  submitIconSrc?: string;
  showKeywordTip?: boolean;
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
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const keywordEntityMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; type: EntityType }>>();
    for (const entity of entities) {
      const candidates = [entity.nameKo, entity.nameEn].filter(Boolean) as string[];
      for (const name of candidates) {
        for (const key of [normalizeKeywordKey(name), compactKeywordKey(name)]) {
          const bucket = map.get(key) ?? [];
          if (!bucket.some((c) => c.id === entity.id && c.type === entity.type)) {
            bucket.push({ id: entity.id, type: entity.type });
          }
          map.set(key, bucket);
        }
      }
    }
    return map;
  }, [entities]);
  const keywordDescriptionMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const [k, v] of Object.entries(KEYWORD_DESC)) {
      map.set(normalizeKeywordKey(k), cleanTooltipText(v));
      map.set(compactKeywordKey(k), cleanTooltipText(v));
    }
    for (const [k, v] of Object.entries(GOLD_TERM_DESC)) {
      map.set(normalizeKeywordKey(k), cleanTooltipText(v));
      map.set(compactKeywordKey(k), cleanTooltipText(v));
    }

    for (const entity of entities) {
      const description =
        entity.powerData?.description
        ?? entity.relicData?.description
        ?? entity.potionData?.description
        ?? entity.enchantmentData?.description;
      if (!description) continue;
      const cleaned = cleanTooltipText(description);
      if (!cleaned) continue;
      map.set(normalizeKeywordKey(entity.nameKo), cleaned);
      map.set(compactKeywordKey(entity.nameKo), cleaned);
      map.set(normalizeKeywordKey(entity.nameEn), cleaned);
      map.set(compactKeywordKey(entity.nameEn), cleaned);
    }

    return map;
  }, [entities]);

  const resolveKeyword = useCallback((keyword: string): KeywordResolution => {
    const cleanKeyword = sanitizeKeywordPart(keyword);
    const { bare, hinted } = parseTypeHint(cleanKeyword);
    const normalized = normalizeKeywordKey(bare);
    const compact = compactKeywordKey(bare);
    const candidates = keywordEntityMap.get(normalized) ?? keywordEntityMap.get(compact) ?? [];
    const entity = hinted
      ? candidates.find((c) => c.type === hinted)
      : [...candidates].sort(
          (a, b) =>
            TYPE_FALLBACK_PRIORITY.indexOf(a.type as (typeof TYPE_FALLBACK_PRIORITY)[number])
            - TYPE_FALLBACK_PRIORITY.indexOf(b.type as (typeof TYPE_FALLBACK_PRIORITY)[number]),
        )[0];
    const description =
      keywordDescriptionMap.get(normalized)
      ?? keywordDescriptionMap.get(compact)
      ?? bare;
    return {
      keyword: bare,
      description,
      entityId: entity?.id,
      entityType: entity?.type,
    };
  }, [keywordDescriptionMap, keywordEntityMap]);

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
      CharacterCount.configure({ limit: maxChars }),
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
  });

  const handleSubmit = useCallback(async () => {
    if (!editor || submitting) return;
    const blocks = tiptapToBlocks(editor.getJSON());
    const text = blocksToPlainText(blocks);

    if (text.length < minChars || text.length > maxChars) return;

    setSubmitting(true);

    try {
      await onSubmit(blocks);
      editor.commands.clearContent();
      setCharCount(0);
      clearDraft(draftKey);
    } finally {
      setSubmitting(false);
    }
  }, [draftKey, editor, maxChars, minChars, onSubmit, submitting]);

  submitRef.current = handleSubmit;

  const isValid = charCount >= minChars && charCount <= maxChars;
  const charCountColor = useMemo(() => {
    if (charCount === 0) return "text-gray-500";
    if (charCount < minChars || charCount > maxChars) return "text-red-400";
    if (charCount >= maxChars - 5) return "text-yellow-400";
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
        <span className={`text-xs font-mono shrink-0 ${charCountColor}`}>
          {charCount}/{maxChars}
        </span>
        {showKeywordTip && (
          <span className="hidden sm:block text-[11px] text-gray-500 truncate flex-1 min-w-0 opacity-70">
            키워드 만들기 예) 크크루빙봉{"{"}
            <span className="spire-gold">빙봉</span>
            {"}"}
            {" · 같은 이름이면 "}
            <span className="spire-gold">{"{빙봉:card}"}</span>
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

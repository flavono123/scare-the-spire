"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { EntityPreview, type EntityInfo, type EntityType } from "@/components/patch-note-renderer";
import { EntityMention, entitySuggestionBase } from "./entity-mention";
import { CustomKeyword } from "./custom-keyword";
import { MentionList, type MentionListRef } from "./mention-list";
import { EntityMapProvider } from "./entity-context";
import { buildEntityMap } from "./post-renderer";
import { tiptapToBlocks, blocksToPlainText, matchEntities } from "@/lib/chemical-utils";
import { GOLD_TERM_DESC, KEYWORD_DESC } from "@/components/codex/codex-description";

const KEYWORD_RE_SOURCE = /(\S+)\{([^{}\n]+)\}/.source;
const KEYWORD_AT_CURSOR_RE = /(\S+)\{([^{}\n]+)\}$/;

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

/**
 * Find text matches in the live ProseMirror doc and replace only those ranges
 * with inline custom-keyword atom nodes. This avoids full-doc setContent resets,
 * which break Korean IME composition and can remount NodeViews.
 */
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

function replaceKeywordsInEditor(
  editor: Editor,
  resolveKeyword: (keyword: string) => KeywordResolution,
): boolean {
  if (replaceKeywordAtCursor(editor, resolveKeyword)) {
    return true;
  }

  const keywordNode = editor.schema.nodes["custom-keyword"];
  if (!keywordNode) return false;

  const replacements: Array<{ from: number; to: number; text: string; keyword: string; description: string; entityId?: string; entityType?: EntityType }> = [];

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

const MAX_CHARS = 30;
const MIN_CHARS = 2;
const DEFAULT_NICKNAME = "익명의 투입터리안";
const NICKNAME_KEY = "sts-chemicalx-nickname";
const CUSTOM_KEYWORD_HINT = {
  visibleText: "크크루빙봉",
  keyword: "빙봉",
};
const CUSTOM_KEYWORD_HINT_RAW = `${CUSTOM_KEYWORD_HINT.visibleText}{[gold]${CUSTOM_KEYWORD_HINT.keyword}[/gold]}`;

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
  const editorRef = useRef<Editor | null>(null);
  const composeTimeoutRef = useRef<number | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const suggestionOpenRef = useRef(false);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const keywordEntityMap = useMemo(() => {
    const map = new Map<string, { id: string; type: EntityType }>();
    for (const entity of entities) {
      const candidates = [entity.nameKo, entity.nameEn].filter(Boolean) as string[];
      for (const name of candidates) {
        const normalized = normalizeKeywordKey(name);
        const compact = compactKeywordKey(name);
        map.set(normalized, { id: entity.id, type: entity.type });
        map.set(compact, { id: entity.id, type: entity.type });
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
    const normalized = normalizeKeywordKey(cleanKeyword);
    const compact = compactKeywordKey(cleanKeyword);
    const entity = keywordEntityMap.get(normalized) ?? keywordEntityMap.get(compact);
    const description =
      keywordDescriptionMap.get(normalized)
      ?? keywordDescriptionMap.get(compact)
      ?? cleanKeyword;
    return {
      keyword: cleanKeyword,
      description,
      entityId: entity?.id,
      entityType: entity?.type,
    };
  }, [keywordDescriptionMap, keywordEntityMap]);
  const customKeywordHintEntity = useMemo(() => {
    const resolved = resolveKeyword(CUSTOM_KEYWORD_HINT.keyword);
    if (!resolved.entityId || !resolved.entityType) return null;
    return entityMap.get(`${resolved.entityType}:${resolved.entityId}`) ?? null;
  }, [entityMap, resolveKeyword]);

  const syncEditorState = useCallback((editor: Editor) => {
    const json = editor.getJSON();
    const blocks = tiptapToBlocks(json);
    const len = blocksToPlainText(blocks).length;
    setCharCount(len);
    if (len > 0) saveDraft(JSON.stringify(json));
    else clearDraft();
  }, []);

  const processEditorUpdate = useCallback((editor: Editor) => {
    if (replaceKeywordsInEditor(editor, resolveKeyword)) {
      return;
    }
    syncEditorState(editor);
  }, [resolveKeyword, syncEditorState]);

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
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
    onDestroy: () => {
      editorRef.current = null;
      if (composeTimeoutRef.current != null) {
        window.clearTimeout(composeTimeoutRef.current);
        composeTimeoutRef.current = null;
      }
    },
    onUpdate: ({ editor }) => {
      // During IME composition, defer conversion until composition settles.
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
        class:
          "min-h-[2.5rem] px-3 py-2 text-sm text-gray-200 outline-none",
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
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <span className={`text-xs font-mono ${charCountColor}`}>
            {charCount}/{MAX_CHARS}
          </span>
          <div className="flex min-w-0 items-start gap-1.5 rounded-md border border-yellow-500/15 bg-yellow-500/8 px-2 py-1.5 text-[11px] text-gray-400">
            <span className="shrink-0 pt-0.5 font-semibold tracking-[0.08em] text-yellow-200/65">
              팁
            </span>
            <div className="min-w-0 leading-relaxed">
              <span className="text-gray-500">예:</span>{" "}
              <code className="font-mono text-[10px] text-gray-500/90">
                {CUSTOM_KEYWORD_HINT_RAW}
              </code>
              <span className="mx-1 text-gray-600">→</span>
              {customKeywordHintEntity ? (
                <EntityPreview entity={customKeywordHintEntity}>
                  {CUSTOM_KEYWORD_HINT.visibleText}
                </EntityPreview>
              ) : (
                <span className="spire-gold font-semibold">
                  {CUSTOM_KEYWORD_HINT.visibleText}
                </span>
              )}
            </div>
          </div>
        </div>
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

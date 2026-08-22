"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "@/components/ui/static-image";
import { RichText } from "@/components/rich-text";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import {
  exitSuggestion,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  EntityMention,
  entityMentionSuggestionPluginKey,
  entitySuggestionBase,
} from "@/components/chemicalx/entity-mention";
import {
  BraceKeywordSuggestion,
  braceKeywordSuggestionPluginKey,
} from "@/components/chemicalx/brace-keyword-suggestion";
import { CustomKeyword } from "@/components/chemicalx/custom-keyword";
import { MentionList, type MentionListRef } from "@/components/chemicalx/mention-list";
import { EntityMapProvider } from "@/components/chemicalx/entity-context";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";
import { YouTubeReferenceExtension } from "@/components/editor/youtube-reference-extension";
import { HistoryRunReferenceExtension } from "@/components/editor/history-run-reference-extension";
import { CostTokenExtension } from "@/components/transfigure/cost-token-extension";
import { keywordsFromCoverSpec } from "@/lib/history-run-reference";
import { isCoverSpec } from "@/lib/run-cover-types";
import {
  SlashCommandList,
  type SlashCommandItem,
  type SlashCommandListRef,
} from "@/components/editor/slash-command-list";
import { SlashCommandSuggestion } from "@/components/editor/slash-command-suggestion";
import {
  buildEntityKeywordIndex,
  blocksToTiptapDocument,
  blocksToPlainText,
  entityKeywordDescription,
  matchEntities,
  normalizeKeywordLookupKey,
  resolveEntityKeyword,
  sanitizeRichTextJson,
  stripNullCharacters,
  tiptapToBlocks,
} from "@/lib/chemical-utils";
import { GOLD_TERM_DESC, KEYWORD_DESC } from "@/components/codex/codex-description";
import type { PostBlock } from "@/lib/chemical-types";
import type { HistoryRunBlock } from "@/lib/chemical-types";
import {
  parseYouTubeVideoId,
  resolveYouTubeReference,
} from "@/lib/youtube-reference";
import {
  COMMENT_MAX_CHARS,
  COMMENT_MIN_CHARS,
  isCharCountNearLimit,
} from "@/lib/content-limits";

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
  return stripNullCharacters(text).replace(/\uFFFC/g, "").trim();
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

function replaceCostTokensInEditor(editor: Editor): boolean {
  const costNode = editor.schema.nodes["cost-token"];
  if (!costNode) return false;

  const replacements: Array<{
    from: number;
    to: number;
    kind: "energy" | "star";
    count: number;
  }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const match of node.text.matchAll(/(@+|\*+)/g)) {
      if (match.index == null) continue;
      const token = match[0]!;
      replacements.push({
        from: pos + match.index,
        to: pos + match.index + token.length,
        kind: token[0] === "@" ? "energy" : "star",
        count: token.length,
      });
    }
  });

  if (replacements.length === 0) return false;

  const tr = editor.state.tr;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const replacement = replacements[i]!;
    tr.replaceWith(
      replacement.from,
      replacement.to,
      costNode.create({
        kind: replacement.kind,
        count: replacement.count,
      }),
    );
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

function parseSavedDraft(draftKey: string) {
  const draft = getSavedDraft(draftKey);
  if (!draft) return undefined;

  try {
    return sanitizeRichTextJson(JSON.parse(draft));
  } catch {
    return undefined;
  }
}

function createPlainTextDocument(initialText: string | undefined) {
  const text = stripNullCharacters(initialText ?? "").trim();
  if (!text) return undefined;

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function getInitialEditorContent(
  draftKey: string,
  initialBlocks: PostBlock[] | undefined,
  initialText: string | undefined,
) {
  return parseSavedDraft(draftKey)
    ?? (initialBlocks ? blocksToTiptapDocument(initialBlocks) : undefined)
    ?? createPlainTextDocument(initialText);
}

function saveDraft(draftKey: string, json: string) {
  sessionStorage.setItem(draftKey, json);
}

function clearDraft(draftKey: string) {
  sessionStorage.removeItem(draftKey);
}

function listenForSuggestionOutsidePress(
  popup: HTMLDivElement,
  onDismiss: () => void,
) {
  const handlePointerDown = (event: PointerEvent) => {
    if (event.target instanceof Node && !popup.contains(event.target)) {
      onDismiss();
    }
  };
  document.addEventListener("pointerdown", handlePointerDown, true);
  return () => document.removeEventListener("pointerdown", handlePointerDown, true);
}

export interface RichContentEditorProps {
  entities: EntityInfo[];
  onSubmit: (blocks: PostBlock[]) => Promise<void>;
  placeholder: string;
  richPlaceholder?: string;
  draftKey: string;
  submitLabel: string;
  minChars?: number;
  /** Null disables the counter and editor-side cap. Defaults to comment length. */
  maxChars?: number | null;
  initialText?: string;
  initialBlocks?: PostBlock[];
  onBlocksChange?: (blocks: PostBlock[]) => void;
  canSubmitBlocks?: (blocks: PostBlock[]) => boolean;
  embedded?: boolean;
  allowLineBreaks?: boolean;
  submitOnEnter?: boolean;
  submitRequestId?: number;
  onValidityChange?: (valid: boolean) => void;
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
  contentReplaceRequest?: {
    requestId: number;
    blocks: PostBlock[];
  } | null;
  youtubeExtension?: {
    pending: string;
    added: string;
    duplicate: string;
    unavailable: string;
  };
  historyRunReferences?: {
    insertRequest: {
      requestId: number;
      block: HistoryRunBlock;
    } | null;
    slashCommands: SlashCommandItem[];
  };
  /** Enable @ / * → in-description energy / star icon atoms (Transfigure). */
  costTokens?: {
    energyIconSrc: string;
    starIconSrc?: string;
  } | null;
  hideSubmitButton?: boolean;
}

export function RichContentEditor({
  entities,
  onSubmit,
  placeholder,
  richPlaceholder,
  draftKey,
  submitLabel,
  minChars = COMMENT_MIN_CHARS,
  maxChars = COMMENT_MAX_CHARS,
  initialText,
  initialBlocks,
  onBlocksChange,
  canSubmitBlocks,
  embedded = false,
  allowLineBreaks = false,
  submitOnEnter = true,
  submitRequestId,
  onValidityChange,
  submitIconSrc,
  showKeywordTip = false,
  keywordTip,
  entityInsertRequest,
  contentReplaceRequest,
  youtubeExtension,
  historyRunReferences,
  costTokens = null,
  hideSubmitButton = false,
}: RichContentEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [youtubeResolving, setYoutubeResolving] = useState(false);
  const [youtubeFeedback, setYoutubeFeedback] = useState<{
    tone: "aqua" | "error";
    message: string;
  } | null>(null);
  const [charCount, setCharCount] = useState(() => {
    const initialContent = getInitialEditorContent(draftKey, initialBlocks, initialText);
    return initialContent ? blocksToPlainText(tiptapToBlocks(initialContent)).length : 0;
  });
  const [blocksSubmittable, setBlocksSubmittable] = useState(() => {
    if (!canSubmitBlocks) return true;
    const initialContent = getInitialEditorContent(draftKey, initialBlocks, initialText);
    return canSubmitBlocks(initialContent ? tiptapToBlocks(initialContent) : []);
  });
  const editorRef = useRef<Editor | null>(null);
  const composeTimeoutRef = useRef<number | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const suggestionOpenRef = useRef(false);
  const lastEntityInsertRequestIdRef = useRef<number | null>(null);
  const lastContentReplaceRequestIdRef = useRef<number | null>(null);
  const lastHistoryRunInsertRequestIdRef = useRef<number | null>(null);
  const lastSubmitRequestIdRef = useRef(submitRequestId);
  const historyRunInsertRequest = historyRunReferences?.insertRequest ?? null;
  const historyRunSlashCommands = historyRunReferences?.slashCommands ?? null;
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
    const json = sanitizeRichTextJson(editor.getJSON());
    const blocks = tiptapToBlocks(json);
    const len = blocksToPlainText(blocks).length;
    setCharCount(len);
    setBlocksSubmittable(canSubmitBlocks ? canSubmitBlocks(blocks) : true);
    onBlocksChange?.(blocks);
    if (len > 0) saveDraft(draftKey, JSON.stringify(json));
    else clearDraft(draftKey);
  }, [canSubmitBlocks, draftKey, onBlocksChange]);

  const processEditorUpdate = useCallback((editor: Editor) => {
    if (replaceCostTokensInEditor(editor)) {
      return;
    }
    if (replaceKeywordsInEditor(editor, resolveKeyword)) {
      return;
    }
    syncEditorState(editor);
  }, [resolveKeyword, syncEditorState]);
  const processEditorUpdateRef = useRef(processEditorUpdate);
  processEditorUpdateRef.current = processEditorUpdate;

  const editor = useEditor({
    immediatelyRender: false,
    content: getInitialEditorContent(draftKey, initialBlocks, initialText),
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: allowLineBreaks ? {} : false,
      }),
      Placeholder.configure({ placeholder: richPlaceholder ? "" : placeholder }),
      CharacterCount.configure(maxChars == null ? {} : { limit: maxChars }),
      CustomKeyword,
      ...(costTokens
        ? [CostTokenExtension.configure({
          energyIconSrc: costTokens.energyIconSrc,
          starIconSrc: costTokens.starIconSrc
            ?? "/images/game-assets/card-misc/star_icon.png",
        })]
        : []),
      ...(youtubeExtension ? [YouTubeReferenceExtension] : []),
      ...(historyRunSlashCommands ? [HistoryRunReferenceExtension] : []),
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
            let stopOutsidePressListener: (() => void) | null = null;
            const dismissPopup = () => {
              suggestionOpenRef.current = false;
              stopOutsidePressListener?.();
              stopOutsidePressListener = null;
              popup?.remove();
              renderer?.destroy();
              popup = null;
              renderer = null;
            };

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
                popup.dataset.richEditorSuggestionPopup = "entity";
                popup.appendChild(renderer.element);
                document.body.appendChild(popup);
                stopOutsidePressListener = listenForSuggestionOutsidePress(
                  popup,
                  () => exitSuggestion(
                    props.editor.view,
                    entityMentionSuggestionPluginKey,
                  ),
                );

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
                  dismissPopup();
                  return true;
                }
                return renderer?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                dismissPopup();
              },
            };
          },
        },
      }),
      BraceKeywordSuggestion.configure({
        suggestion: {
          char: "",
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
            let stopOutsidePressListener: (() => void) | null = null;

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
            const dismissPopup = () => {
              suggestionOpenRef.current = false;
              stopOutsidePressListener?.();
              stopOutsidePressListener = null;
              popup?.remove();
              renderer?.destroy();
              popup = null;
              renderer = null;
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
                popup.dataset.richEditorSuggestionPopup = "keyword";
                popup.appendChild(renderer.element);
                document.body.appendChild(popup);
                stopOutsidePressListener = listenForSuggestionOutsidePress(
                  popup,
                  () => exitSuggestion(
                    props.editor.view,
                    braceKeywordSuggestionPluginKey,
                  ),
                );

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
                  dismissPopup();
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
                dismissPopup();
              },
            };
          },
        },
      }),
      ...(historyRunSlashCommands ? [
        SlashCommandSuggestion.configure({
          suggestion: {
            char: "/",
            allowSpaces: false,
            items: ({ query }: { query: string }) => {
              const normalized = query.trim().toLowerCase();
              return historyRunSlashCommands.filter((command) => (
                !normalized
                || command.label.toLowerCase().includes(normalized)
                || command.aliases.some((alias) => (
                  alias.replace(/^\//, "").toLowerCase().includes(normalized)
                ))
              ));
            },
            command: ({ editor: ed, range, props }) => {
              const command = props as unknown as SlashCommandItem;
              ed.chain().focus().deleteRange(range).run();
              window.setTimeout(command.onSelect, 0);
            },
            render: () => {
              let renderer: ReactRenderer<SlashCommandListRef> | null = null;
              let popup: HTMLDivElement | null = null;

              const buildCommand = (props: SuggestionProps) => (
                command: SlashCommandItem,
              ) => {
                props.command(command as unknown as Record<string, unknown>);
              };

              return {
                onStart: (props: SuggestionProps) => {
                  suggestionOpenRef.current = true;
                  renderer = new ReactRenderer(SlashCommandList, {
                    props: {
                      items: props.items as SlashCommandItem[],
                      command: buildCommand(props),
                    },
                    editor: props.editor,
                  });

                  popup = document.createElement("div");
                  popup.style.position = "fixed";
                  popup.style.zIndex = "130";
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
                    items: props.items as SlashCommandItem[],
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
      ] : []),
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
        class: embedded
          ? "h-full min-h-full w-full cursor-text px-1 py-1 text-center leading-[1.18] text-inherit outline-none"
          : `${
            allowLineBreaks || (maxChars != null && maxChars > 80)
              ? "min-h-[6.5rem] max-h-[12rem] overflow-y-auto"
              : richPlaceholder ? "min-h-[3.75rem]" : "min-h-[2.5rem]"
          } px-3 py-2 text-sm text-gray-200 outline-none`,
        "aria-placeholder": richPlaceholder ? cleanTooltipText(richPlaceholder) : placeholder,
        ...(embedded ? { "data-card-description-fit-content": "true" } : {}),
      },
      handleDOMEvents: {
        compositionend: () => {
          window.setTimeout(() => {
            const currentEditor = editorRef.current;
            if (!currentEditor || currentEditor.isDestroyed) return;
            processEditorUpdate(currentEditor);
          }, 0);
          return false;
        },
      },
      transformPastedText: stripNullCharacters,
      handlePaste: (view, event) => {
        if (!youtubeExtension) return false;

        const pastedText = event.clipboardData?.getData("text/plain").trim() ?? "";
        const videoId = parseYouTubeVideoId(pastedText);
        if (!videoId) return false;

        event.preventDefault();

        let alreadyReferenced = false;
        view.state.doc.descendants((node) => {
          if (node.type.name === "youtube-reference") {
            alreadyReferenced = true;
          }
        });
        if (alreadyReferenced) {
          setYoutubeFeedback({ tone: "error", message: youtubeExtension.duplicate });
          return true;
        }

        const referenceNode = view.state.schema.nodes["youtube-reference"];
        if (!referenceNode) return true;

        const insertTransaction = view.state.tr
          .replaceSelectionWith(referenceNode.create({
            videoId,
            title: "",
            pendingLabel: youtubeExtension.pending,
          }))
          .insertText(" ")
          .scrollIntoView();
        view.dispatch(insertTransaction);
        setYoutubeResolving(true);
        setYoutubeFeedback({ tone: "aqua", message: youtubeExtension.pending });

        void resolveYouTubeReference(pastedText)
          .then((reference) => {
            const currentEditor = editorRef.current;
            if (!currentEditor || currentEditor.isDestroyed || currentEditor.view !== view) return;

            let referencePosition: number | null = null;
            view.state.doc.descendants((node, position) => {
              if (
                referencePosition == null
                && node.type.name === "youtube-reference"
                && node.attrs.videoId === videoId
              ) {
                referencePosition = position;
              }
            });
            if (referencePosition == null) return;

            view.dispatch(view.state.tr.setNodeMarkup(
              referencePosition,
              undefined,
              {
                videoId: reference.videoId,
                title: reference.title,
                pendingLabel: youtubeExtension.pending,
              },
            ));
            setYoutubeFeedback({
              tone: "aqua",
              message: youtubeExtension.added.replace("{title}", reference.title),
            });
          })
          .catch(() => {
            const currentEditor = editorRef.current;
            if (!currentEditor || currentEditor.isDestroyed || currentEditor.view !== view) return;

            let referencePosition: number | null = null;
            let referenceSize = 0;
            view.state.doc.descendants((node, position) => {
              if (
                referencePosition == null
                && node.type.name === "youtube-reference"
                && node.attrs.videoId === videoId
              ) {
                referencePosition = position;
                referenceSize = node.nodeSize;
              }
            });
            if (referencePosition != null) {
              view.dispatch(view.state.tr.delete(
                referencePosition,
                referencePosition + referenceSize,
              ));
            }
            setYoutubeFeedback({ tone: "error", message: youtubeExtension.unavailable });
          })
          .finally(() => {
            setYoutubeResolving(false);
          });

        return true;
      },
      handleKeyDown: (_view, event) => {
        if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
          if (suggestionOpenRef.current) {
            return false;
          }
          submitRef.current();
          return true;
        }
        return false;
      },
    },
  }, [
    draftKey,
    allowLineBreaks,
    embedded,
    entities,
    initialBlocks,
    initialText,
    maxChars,
    placeholder,
    richPlaceholder,
    submitOnEnter,
    youtubeExtension,
    historyRunSlashCommands,
  ]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const blocks = tiptapToBlocks(sanitizeRichTextJson(editor.getJSON()));
    setBlocksSubmittable(canSubmitBlocks ? canSubmitBlocks(blocks) : true);
  }, [canSubmitBlocks, editor]);

  useEffect(() => {
    if (
      !editor
      || !contentReplaceRequest
      || lastContentReplaceRequestIdRef.current === contentReplaceRequest.requestId
    ) {
      return;
    }

    lastContentReplaceRequestIdRef.current = contentReplaceRequest.requestId;
    const selectionPosition = editor.state.selection.from;
    const json = blocksToTiptapDocument(contentReplaceRequest.blocks);
    editor.commands.setContent(json, { emitUpdate: false });
    const nextSelectionPosition = Math.min(
      selectionPosition,
      editor.state.doc.content.size,
    );
    editor.commands.setTextSelection(nextSelectionPosition);
    editor.commands.focus();

    const blocks = tiptapToBlocks(sanitizeRichTextJson(editor.getJSON()));
    const len = blocksToPlainText(blocks).length;
    setCharCount(len);
    setBlocksSubmittable(canSubmitBlocks ? canSubmitBlocks(blocks) : true);
    if (len > 0) saveDraft(draftKey, JSON.stringify(json));
    else clearDraft(draftKey);
  }, [
    canSubmitBlocks,
    contentReplaceRequest,
    draftKey,
    editor,
  ]);

  useEffect(() => {
    if (
      !editor
      || !entityInsertRequest
      || lastEntityInsertRequestIdRef.current === entityInsertRequest.requestId
    ) {
      return;
    }

    lastEntityInsertRequestIdRef.current = entityInsertRequest.requestId;
    const { entity } = entityInsertRequest;
    window.setTimeout(() => {
      if (editor.isDestroyed || !editor.schema.nodes["entity-mention"]) return;

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
            mentionSuggestionChar: "",
          },
        },
        { type: "text", text: " " },
      ]).run();
    }, 0);
  }, [editor, entityInsertRequest]);

  useEffect(() => {
    const request = historyRunInsertRequest;
    if (
      !editor
      || !request
      || lastHistoryRunInsertRequestIdRef.current === request.requestId
    ) {
      return;
    }

    const { block } = request;
    window.setTimeout(() => {
      if (editor.isDestroyed || !editor.schema.nodes["history-run-reference"]) return;

      lastHistoryRunInsertRequestIdRef.current = request.requestId;
      const { $from } = editor.state.selection;
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 1),
        $from.parentOffset,
        undefined,
        "\uFFFC",
      );
      const needsLeadingSpace = textBefore.length > 0 && !/\s/.test(textBefore);
      const cover = isCoverSpec(block.snapshot.coverSpec)
        ? block.snapshot.coverSpec
        : null;
      const keywordNodes = keywordsFromCoverSpec(cover).flatMap((token) => {
        const resolved = resolveKeyword(token);
        return [
          {
            type: "custom-keyword" as const,
            attrs: {
              text: token,
              keyword: resolved.keyword,
              description: resolved.description,
              entityId: resolved.entityId ?? "",
              entityType: resolved.entityType ?? "",
            },
          },
          { type: "text" as const, text: " " },
        ];
      });

      editor.chain().focus().insertContent([
        ...(needsLeadingSpace ? [{ type: "text", text: " " }] : []),
        {
          type: "history-run-reference",
          attrs: {
            runId: block.runId,
            title: block.snapshot.title ?? "",
            character: block.snapshot.character,
            startTime: block.snapshot.startTime,
            ascension: block.snapshot.ascension,
            win: block.snapshot.win,
            totalFloors: block.snapshot.totalFloors,
            runTime: block.snapshot.runTime,
            build: block.snapshot.build,
            seed: block.snapshot.seed,
            coverSpec: block.snapshot.coverSpec ?? null,
          },
        },
        { type: "text", text: " " },
        ...keywordNodes,
      ]).run();
    }, 0);
  }, [editor, historyRunInsertRequest, resolveKeyword]);

  const handleSubmit = useCallback(async () => {
    if (!editor || submitting) return;
    const blocks = tiptapToBlocks(sanitizeRichTextJson(editor.getJSON()));
    const text = blocksToPlainText(blocks);

    if (text.length < minChars || (maxChars != null && text.length > maxChars)) return;

    setSubmitting(true);

    try {
      await onSubmit(blocks);
      editor.commands.clearContent();
      setCharCount(0);
      setYoutubeFeedback(null);
      clearDraft(draftKey);
    } catch {
      // Keep the draft intact when the backing store is unavailable.
    } finally {
      setSubmitting(false);
    }
  }, [draftKey, editor, maxChars, minChars, onSubmit, submitting]);

  submitRef.current = handleSubmit;

  const isValid = (
    !youtubeResolving
    && blocksSubmittable
    && charCount >= minChars
    && (maxChars == null || charCount <= maxChars)
  );
  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  useEffect(() => {
    if (
      submitRequestId == null
      || lastSubmitRequestIdRef.current === submitRequestId
    ) {
      return;
    }
    lastSubmitRequestIdRef.current = submitRequestId;
    if (isValid) void handleSubmit();
  }, [handleSubmit, isValid, submitRequestId]);

  const charCountColor = useMemo(() => {
    if (charCount === 0) return "text-gray-500";
    if (charCount < minChars || (maxChars != null && charCount > maxChars)) return "text-red-400";
    if (maxChars != null && isCharCountNearLimit(charCount, maxChars)) return "text-primary";
    return "text-gray-400";
  }, [charCount, maxChars, minChars]);

  return (
    <div
      className={embedded
        ? "h-full w-full overflow-visible"
        : "overflow-visible rounded-lg border border-border bg-card/30"}
      data-rich-editor-surface={embedded ? "embedded" : "default"}
    >
      <div className={`relative overflow-visible ${embedded ? "h-full" : ""}`}>
        {richPlaceholder && charCount === 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-2 font-game-text text-sm leading-5 text-muted-foreground"
          >
            <RichText text={richPlaceholder} />
          </div>
        )}
        <EntityMapProvider value={entityMap}>
          <EditorContent
            editor={editor}
            className={`relative z-10 ${embedded ? "h-full" : ""}`}
          />
        </EntityMapProvider>
      </div>

      {!embedded && youtubeFeedback && (
        <p
          className={`border-t border-border px-3 py-1.5 text-[11px] ${
            youtubeFeedback.tone === "aqua" ? "sts-text-aqua" : "text-red-300"
          }`}
          role={youtubeFeedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {youtubeFeedback.message}
        </p>
      )}

      {!embedded && (
        <div className="flex items-center gap-3 border-t border-border px-3 py-2">
          {maxChars != null && (
            <span
              className={`shrink-0 font-mono text-xs tabular-nums ${charCountColor}`}
              aria-live="polite"
            >
              {charCount}/{maxChars}
            </span>
          )}
          {showKeywordTip && keywordTip && (
            <span className="hidden min-w-0 flex-1 truncate text-[11px] text-gray-500 opacity-70 sm:block">
              {keywordTip.label} {keywordTip.text}
              {"{"}
              <span className="spire-gold">{keywordTip.keyword}</span>
              {"}"}
              {" → "}
              <span className="spire-gold">{keywordTip.result}</span>
            </span>
          )}
          {!hideSubmitButton && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded bg-primary/20 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
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
          )}
        </div>
      )}
    </div>
  );
}

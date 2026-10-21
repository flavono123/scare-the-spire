"use client";

import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { RichText } from "@/components/rich-text";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import {
  TextEffectSelectionOnly,
  TransfigureColor,
  TransfigureJitter,
  TransfigureSine,
} from "@/components/text-effects/extensions";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  EntityMention,
  entitySuggestionBase,
} from "@/components/chemicalx/entity-mention";
import {
  BraceKeywordSuggestion,
  braceKeywordSuggestionPluginKey,
} from "@/components/chemicalx/brace-keyword-suggestion";
import { CustomKeyword } from "@/components/chemicalx/custom-keyword";
import { MentionList } from "@/components/chemicalx/mention-list";
import { suggestionPopupRender } from "@/components/editor/suggestion-popup";
import { EditorLinkBubble, EditorLinkClicks } from "@/components/editor/link-bubble";
import {
  EntityLinksProvider,
  EntityMapProvider,
} from "@/components/chemicalx/entity-context";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";
import { YouTubeReferenceExtension } from "@/components/editor/youtube-reference-extension";
import { HistoryRunReferenceExtension } from "@/components/editor/history-run-reference-extension";
import { HistoryRunFloorExtension, replaceExclusiveHistoryFloor } from "@/components/editor/history-run-floor-extension";
import { TextConExtension } from "@/components/editor/text-con-extension";
import { TextConPanel } from "@/components/text-con/text-con-panel";
import { TextConPopup } from "@/components/text-con/text-con-popup";
import { CardConExtension } from "@/components/editor/card-con-extension";
import { CardConPanel } from "@/components/card-con/card-con-panel";
import { EmoteConExtension } from "@/components/editor/emote-con-extension";
import { EmoteSheet } from "@/components/emote-con/emote-sheet";
import { EmoteWheel } from "@/components/emote-con/emote-wheel";
import { AnchoredConPopup } from "@/components/editor/anchored-con-popup";
import { TinyCardToken } from "@/components/history-course/card-action-icon";
import {
  CARD_CON_POPUP_HEIGHT,
  CARD_CON_POPUP_WIDTH,
} from "@/lib/card-con";
import { EMOTE_DESKTOP_WHEEL_PX, emotePlainText, isEmoteId, type EmoteId } from "@/lib/emote-con";
import { useCardConLocale } from "@/hooks/use-card-con-locale";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { applyCardConLocale } from "@/lib/card-con-locale";
import { serviceMessages } from "@/messages/service";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import { Type } from "lucide-react";
import { CostTokenExtension } from "@/components/transfigure/cost-token-extension";
import { keywordsFromCoverSpec } from "@/lib/history-run-reference";
import { isCoverSpec } from "@/lib/run-cover-types";
import {
  SlashCommandList,
  type SlashCommandItem,
} from "@/components/editor/slash-command-list";
import {
  SlashCommandSuggestion,
  slashCommandPluginKey,
} from "@/components/editor/slash-command-suggestion";
import { findFloorHashMatch, FloorHashSuggestion, floorHashPluginKey } from "@/components/editor/floor-hash-suggestion";
import { FloorMentionList } from "@/components/history-course/floor-mention-list";
import {
  buildEntityKeywordIndex,
  blocksToTiptapDocument,
  blocksToPlainText,
  entityDisplayNames,
  entityKeywordDescription,
  matchEntities,
  normalizeKeywordLookupKey,
  resolveEntityKeyword,
  sanitizeRichTextJson,
  stripNullCharacters,
  tiptapToBlocks,
} from "@/lib/chemical-utils";
import {
  braceDisplayText,
  buildExactKeywordIndex,
  buildExactKeywordLabels,
  findClosedBraceKeywords,
  findExactKeywordRanges,
  inProgressKeywordRange,
  type ExactKeywordLabel,
} from "@/lib/rich-keyword-plain-text";
import { GOLD_TERM_DESC, KEYWORD_DESC } from "@/components/codex/codex-description";
import { GameScrollArea } from "@/components/game-scroll-area";
import type { HistoryRunBlock, HistoryRunFloorBlock, PostBlock } from "@/lib/chemical-types";
import {
  isHistoryRunFloorBlock,
  matchHistoryFloorMentions,
} from "@/lib/history-run-floor";
import {
  parseYouTubeVideoId,
  resolveYouTubeReference,
} from "@/lib/youtube-reference";
import {
  COMMENT_MAX_CHARS,
  COMMENT_MIN_CHARS,
  isCharCountNearLimit,
} from "@/lib/content-limits";

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
  const match = findClosedBraceKeywords(textBefore).at(-1);
  if (!match || match.to !== textBefore.length) return false;

  const text = sanitizeKeywordPart(match.display ?? match.keyword);
  const keyword = sanitizeKeywordPart(match.keyword);
  if (!text || !keyword) return false;

  const resolved = resolveKeyword(keyword);
  const start = from - (match.to - match.from);
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
    for (const match of findClosedBraceKeywords(node.text)) {
      const keyword = sanitizeKeywordPart(match.keyword);
      const keywordText = sanitizeKeywordPart(match.display ?? match.keyword);
      if (!keywordText || !keyword) continue;
      const resolved = resolveKeyword(keyword);
      replacements.push({
        from: pos + match.from,
        to: pos + match.to,
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

function replaceExactKeywordsInEditor(
  editor: Editor,
  labelsByFirst: Map<string, ExactKeywordLabel[]>,
  resolveKeyword: (keyword: string) => KeywordResolution,
  commitCursorToken: boolean,
): boolean {
  const keywordNode = editor.schema.nodes["custom-keyword"];
  if (!keywordNode || labelsByFirst.size === 0) return false;

  const cursor = editor.state.selection.from;
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
    const skip = cursor >= pos && cursor <= pos + node.nodeSize
      ? inProgressKeywordRange(
        node.text,
        cursor - pos,
        commitCursorToken,
      )
      : null;
    for (const range of findExactKeywordRanges(node.text, labelsByFirst, skip)) {
      const resolved = resolveKeyword(range.label);
      replacements.push({
        from: pos + range.from,
        to: pos + range.to,
        text: range.label,
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
    const { from, to, text, keyword, description, entityId, entityType } = replacements[i]!;
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
  density?: "default" | "inline";
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
  historyFloorInsertRequest?: {
    requestId: number;
    block: HistoryRunFloorBlock;
  } | null;
  historyFloorMentions?: {
    catalog: HistoryRunFloorBlock[];
    currentFloor?: number;
  } | null;
  toolbarStart?: ReactNode;
  floorHashTip?: {
    token: string;
    text: string;
    example: string;
  };
  /** Enable @ / * → in-description energy / star icon atoms (Transfigure). */
  costTokens?: {
    energyIconSrc: string;
    starIconSrc?: string;
  } | null;
  hideSubmitButton?: boolean;
  enableTextCon?: boolean;
  enableCardCon?: boolean;
  /** Multiplayer reaction-wheel icons. Comments opt in; other composers stay off. */
  enableEmote?: boolean;
  /** Keyword/mention atoms link to the Compendium; off keeps them hover-only. */
  entityLinks?: boolean;
  /** Pagestorm color, sine, and jitter marks. Stored as RichText tags. */
  textEffects?: boolean;
  onEditor?: (editor: Editor | null) => void;
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
  density = "default",
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
  historyFloorInsertRequest = null,
  historyFloorMentions = null,
  toolbarStart,
  floorHashTip,
  costTokens = null,
  hideSubmitButton = false,
  enableTextCon = true,
  enableCardCon = true,
  enableEmote = false,
  entityLinks = true,
  textEffects = false,
  onEditor,
}: RichContentEditorProps) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const cardConLocale = useCardConLocale(gameLocale);
  const cardConCopy = serviceMessages[serviceLocale].cardCon;
  const textConCopy = serviceMessages[serviceLocale].textCon;
  const emoteCopy = serviceMessages[serviceLocale].emoteCon;
  const [submitting, setSubmitting] = useState(false);
  const [textConModalOpen, setTextConModalOpen] = useState(false);
  const [textConAnchor, setTextConAnchor] = useState<DOMRect | null>(null);
  const textConTriggerRef = useRef<HTMLButtonElement>(null);
  const textConSheetRef = useRef<HTMLDivElement>(null);
  const [cardConModalOpen, setCardConModalOpen] = useState(false);
  const [cardConAnchor, setCardConAnchor] = useState<DOMRect | null>(null);
  const cardConTriggerRef = useRef<HTMLButtonElement>(null);
  const cardConSheetRef = useRef<HTMLDivElement>(null);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [emoteAnchor, setEmoteAnchor] = useState<DOMRect | null>(null);
  const emoteTriggerRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (textConModalOpen && isMobile && textConSheetRef.current) {
      const rect = textConSheetRef.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        textConSheetRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [textConModalOpen, isMobile]);

  useEffect(() => {
    if (cardConModalOpen && isMobile && cardConSheetRef.current) {
      const rect = cardConSheetRef.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        cardConSheetRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [cardConModalOpen, isMobile]);
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
  const setSuggestionOpen = useCallback((open: boolean) => {
    suggestionOpenRef.current = open;
  }, []);
  const lastEntityInsertRequestIdRef = useRef<number | null>(null);
  const lastContentReplaceRequestIdRef = useRef<number | null>(null);
  const lastHistoryRunInsertRequestIdRef = useRef<number | null>(null);
  const lastHistoryFloorInsertRequestIdRef = useRef<number | null>(null);
  const lastSubmitRequestIdRef = useRef(submitRequestId);
  const historyRunInsertRequest = historyRunReferences?.insertRequest ?? null;
  const historyRunSlashCommands = historyRunReferences?.slashCommands ?? null;
  const historyFloorCatalog = historyFloorMentions?.catalog ?? [];
  const enableFloorHash = historyFloorCatalog.length > 0;
  const floorCatalogRef = useRef(historyFloorCatalog);
  floorCatalogRef.current = historyFloorCatalog;
  const currentFloorRef = useRef(historyFloorMentions?.currentFloor);
  currentFloorRef.current = historyFloorMentions?.currentFloor;
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const resolveLinkEntity = useCallback(
    (type: string, id: string) => entityMap.get(`${type}:${id}`),
    [entityMap],
  );
  const keywordEntityIndex = useMemo(() => buildEntityKeywordIndex(entities), [entities]);
  const exactKeywordIndex = useMemo(() => buildExactKeywordIndex(buildExactKeywordLabels([
    ...entities.flatMap(entityDisplayNames),
    ...Object.keys(KEYWORD_DESC),
    ...Object.keys(GOLD_TERM_DESC),
  ])), [entities]);
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
    if (replaceExactKeywordsInEditor(editor, exactKeywordIndex, resolveKeyword, false)) {
      return;
    }
    syncEditorState(editor);
  }, [exactKeywordIndex, resolveKeyword, syncEditorState]);
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
      EditorLinkClicks,
      CharacterCount.configure(maxChars == null ? {} : { limit: maxChars }),
      CustomKeyword,
      ...(textEffects
        ? [TransfigureColor, TransfigureSine, TransfigureJitter, TextEffectSelectionOnly]
        : []),
      ...(costTokens
        ? [CostTokenExtension.configure({
          energyIconSrc: costTokens.energyIconSrc,
          starIconSrc: costTokens.starIconSrc
            ?? "/images/game-assets/card-misc/star_icon.png",
        })]
        : []),
      ...(youtubeExtension ? [YouTubeReferenceExtension] : []),
      ...(historyRunSlashCommands ? [HistoryRunReferenceExtension] : []),
      HistoryRunFloorExtension,
      ...(enableTextCon ? [TextConExtension] : []),
      ...(enableCardCon ? [CardConExtension] : []),
      ...(enableEmote ? [EmoteConExtension] : []),
      ...(enableFloorHash ? [
        FloorHashSuggestion.configure({
          suggestion: {
            pluginKey: floorHashPluginKey,
            char: "#",
            allowSpaces: false,
            findSuggestionMatch: findFloorHashMatch,
            items: ({ query }: { query: string }) => matchHistoryFloorMentions(
              query,
              floorCatalogRef.current,
              currentFloorRef.current,
            ),
            command: ({ editor: ed, range, props }) => {
              if (!isHistoryRunFloorBlock(props)) return;
              replaceExclusiveHistoryFloor(ed, props, range);
            },
            render: suggestionPopupRender({
              component: FloorMentionList,
              pluginKey: floorHashPluginKey,
              name: "history-floor",
              onOpenChange: setSuggestionOpen,
            }),
          },
        }),
      ] : []),
      EntityMention.configure({
        HTMLAttributes: {
          class: "spire-gold font-semibold",
        },
        suggestion: entitySuggestionBase,
      }),
      BraceKeywordSuggestion.configure({
        suggestion: {
          char: "",
          allowSpaces: true,
          items: ({ query }: { query: string }) => {
            const trimmed = query.trim();
            if (!trimmed) return entities.slice(0, 8);
            return matchEntities(trimmed, entities);
          },
          command: ({ editor: ed, range, props }) => {
            const keywordNode = ed.schema.nodes["custom-keyword"];
            if (!keywordNode) return;
            const item = props as unknown as EntityInfo;
            const display = braceDisplayText(ed.state.doc.textBetween(range.from, range.to))
              ?? item.nameKo;
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
          render: suggestionPopupRender({
            component: MentionList,
            pluginKey: braceKeywordSuggestionPluginKey,
            name: "keyword",
            toCommandProps: (item: EntityInfo) => ({
              id: item.id,
              label: item.nameKo,
              entityType: item.type,
              type: item.type,
              nameKo: item.nameKo,
              nameEn: item.nameEn,
              color: item.color,
              imageUrl: item.imageUrl,
            }),
            // `}` picks the highlighted row instead of typing a brace.
            commitKeys: ["}"],
            onOpenChange: setSuggestionOpen,
          }),
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
            render: suggestionPopupRender({
              component: SlashCommandList,
              pluginKey: slashCommandPluginKey,
              name: "slash-command",
              onOpenChange: setSuggestionOpen,
            }),
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
          : density === "inline"
            ? "min-h-[1.25rem] px-1.5 py-0.5 text-xs leading-5 text-gray-200 outline-none"
          : `${
            allowLineBreaks || (maxChars != null && maxChars > 80)
              ? "min-h-[6.5rem]"
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
    density,
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
    enableFloorHash,
  ]);

  useEffect(() => {
    onEditor?.(editor ?? null);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

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

  useEffect(() => {
    const request = historyFloorInsertRequest;
    if (
      !editor
      || !request
      || lastHistoryFloorInsertRequestIdRef.current === request.requestId
    ) {
      return;
    }

    const { block } = request;
    window.setTimeout(() => {
      if (editor.isDestroyed || !editor.schema.nodes["history-run-floor"]) return;

      lastHistoryFloorInsertRequestIdRef.current = request.requestId;
      replaceExclusiveHistoryFloor(editor, block);
    }, 0);
  }, [editor, historyFloorInsertRequest]);

  const handleInsertTextCon = useCallback(
    (data: { text: string; bgColor: string; textColor: string }) => {
      if (!editor) return;
      const type = editor.schema.nodes["text-con"];
      if (!type) return;

      editor
        .chain()
        .focus()
        .insertContent({
          type: "text-con",
          attrs: {
            text: data.text,
            bgColor: data.bgColor,
            textColor: data.textColor,
          },
        })
        .run();
      setTextConModalOpen(false);
    },
    [editor],
  );

  const handleInsertCardCon = useCallback(
    (entity: EntityInfo) => {
      if (!editor || entity.type !== "card") return;
      const type = editor.schema.nodes["card-con"];
      if (!type) return;

      const savedCard = entity.cardData
        ? applyCardConLocale(entity.cardData, cardConLocale?.[entity.id])
        : null;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "card-con",
          attrs: {
            cardId: entity.id,
            displayText: savedCard?.name || entity.nameKo,
            gameLocale,
          },
        })
        .run();
      setCardConModalOpen(false);
    },
    [cardConLocale, editor, gameLocale],
  );

  const handleInsertEmote = useCallback(
    (emoteId: EmoteId) => {
      if (!editor || !isEmoteId(emoteId)) return;
      const type = editor.schema.nodes["emote-con"];
      if (!type) return;

      const current = blocksToPlainText(tiptapToBlocks(sanitizeRichTextJson(editor.getJSON())));
      const nextLength = current.length + emotePlainText(emoteId).length;
      if (maxChars != null && nextLength > maxChars) {
        setEmoteOpen(false);
        return;
      }

      editor
        .chain()
        .focus()
        .insertContent({
          type: "emote-con",
          attrs: { emoteId },
        })
        .run();
      setEmoteOpen(false);
    },
    [editor, maxChars],
  );

  const handleSubmit = useCallback(async () => {
    if (!editor || submitting) return;
    replaceExactKeywordsInEditor(editor, exactKeywordIndex, resolveKeyword, true);
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
  }, [draftKey, editor, exactKeywordIndex, maxChars, minChars, onSubmit, resolveKeyword, submitting]);

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

  const inline = density === "inline";

  return (
    <div
      className={embedded
        ? "h-full w-full overflow-visible"
        : inline
          ? "flex min-w-0 items-center gap-1 overflow-visible rounded border border-white/15 bg-black/25"
          : "overflow-visible rounded-lg border border-border bg-card/30"}
      data-rich-editor-surface={embedded ? "embedded" : inline ? "inline" : "default"}
    >
      <div className={`relative overflow-visible ${embedded ? "h-full" : inline ? "min-w-0 flex-1" : ""}`}>
        {richPlaceholder && charCount === 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-2 font-game-text text-sm leading-5 text-muted-foreground"
          >
            <RichText text={richPlaceholder} />
          </div>
        )}
        <EntityMapProvider value={entityMap}>
        <EntityLinksProvider value={entityLinks}>
          {embedded ? (
            <EditorContent
              editor={editor}
              className="relative z-10 h-full"
            />
          ) : (
            <GameScrollArea
              className={
                inline
                  ? undefined
                  : allowLineBreaks || (maxChars != null && maxChars > 80)
                  ? "max-h-[12rem]"
                  : undefined
              }
              size="small"
            >
              <EditorContent
                editor={editor}
                className="relative z-10"
              />
            </GameScrollArea>
          )}
        </EntityLinksProvider>
        </EntityMapProvider>
        {editor ? (
          <EditorLinkBubble
            editor={editor}
            resolveEntity={entityLinks ? resolveLinkEntity : undefined}
          />
        ) : null}
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
        <div className={`flex flex-wrap items-center gap-1 ${inline ? "shrink-0 px-1 py-0.5" : "gap-2 border-t border-border px-3 py-2 sm:gap-3"}`}>
          {toolbarStart}
          {enableTextCon && (
            <GameUiHoverTip label={textConCopy.make} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
              <button
                ref={textConTriggerRef}
                type="button"
                data-text-con-trigger=""
                onClick={() => {
                  if (!textConModalOpen) {
                    const rect = textConTriggerRef.current?.getBoundingClientRect();
                    if (rect) setTextConAnchor(rect);
                  }
                  setCardConModalOpen(false);
                  setEmoteOpen(false);
                  setTextConModalOpen((prev) => !prev);
                }}
                className={`flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
                  textConModalOpen
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border/80 bg-card/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                }`}
                aria-label={textConCopy.label}
                aria-expanded={textConModalOpen}
              >
                <Type size={13} className="shrink-0" />
                <span className={inline ? "sr-only" : undefined}>{textConCopy.label}</span>
              </button>
            </GameUiHoverTip>
          )}
          {enableCardCon && (
            <GameUiHoverTip label={cardConCopy.make} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
              <button
                ref={cardConTriggerRef}
                type="button"
                data-card-con-trigger=""
                onClick={() => {
                  if (!cardConModalOpen) {
                    const rect = cardConTriggerRef.current?.getBoundingClientRect();
                    if (rect) setCardConAnchor(rect);
                  }
                  setTextConModalOpen(false);
                  setEmoteOpen(false);
                  setCardConModalOpen((prev) => !prev);
                }}
                className={`flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
                  cardConModalOpen
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border/80 bg-card/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                }`}
                aria-label={cardConCopy.label}
                aria-expanded={cardConModalOpen}
              >
                <TinyCardToken width={13} />
                <span className={inline ? "sr-only" : undefined}>{cardConCopy.label}</span>
              </button>
            </GameUiHoverTip>
          )}
          {enableEmote && (
            <GameUiHoverTip label={emoteCopy.make} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
              <button
                ref={emoteTriggerRef}
                type="button"
                data-emote-con-trigger=""
                onClick={() => {
                  if (!emoteOpen) {
                    const rect = emoteTriggerRef.current?.getBoundingClientRect();
                    if (rect) setEmoteAnchor(rect);
                  }
                  setTextConModalOpen(false);
                  setCardConModalOpen(false);
                  setEmoteOpen((prev) => !prev);
                }}
                className={`flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
                  emoteOpen
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border/80 bg-card/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                }`}
                aria-label={emoteCopy.label}
                aria-expanded={emoteOpen}
              >
                <Image
                  src="/images/sts2/ui/emote/heart.png"
                  alt=""
                  width={13}
                  height={13}
                  className="h-[13px] w-[13px] shrink-0 object-contain grayscale brightness-[0.72]"
                />
                <span className={inline ? "sr-only" : undefined}>{emoteCopy.label}</span>
              </button>
            </GameUiHoverTip>
          )}
          {maxChars != null && !inline && (
            <span
              className={`shrink-0 font-mono text-xs tabular-nums ${charCountColor}`}
              aria-live="polite"
            >
              {charCount}/{maxChars}
            </span>
          )}
          {floorHashTip && (
            <span className="hidden min-w-0 flex-1 truncate text-[11px] text-gray-500 opacity-70 sm:block">
              <span className="spire-gold">{floorHashTip.token}</span>
              {floorHashTip.text}
              <span className="spire-gold">{floorHashTip.example}</span>
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
            className={`${inline ? "px-1.5 py-0.5 text-[11px]" : "ml-auto px-3 py-1 text-xs"} flex shrink-0 items-center gap-1.5 rounded bg-primary/20 font-semibold text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-40`}
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

      {enableTextCon && textConModalOpen && isMobile && (
        <div
          ref={textConSheetRef}
          data-text-con-sheet=""
          className="border-t border-border/70 bg-zinc-950/98 p-3.5 animate-in slide-in-from-top-2 duration-150 sm:p-4"
        >
          <TextConPanel
            onClose={() => setTextConModalOpen(false)}
            onInsert={handleInsertTextCon}
            autoFocus={false}
          />
        </div>
      )}

      {enableTextCon && textConModalOpen && !isMobile && (
        <TextConPopup
          open={textConModalOpen}
          anchor={textConAnchor}
          triggerRef={textConTriggerRef}
          onClose={() => setTextConModalOpen(false)}
          onInsert={handleInsertTextCon}
          autoFocus={true}
        />
      )}

      {enableCardCon && cardConModalOpen && isMobile && (
        <div
          ref={cardConSheetRef}
          data-card-con-sheet=""
          className="border-t border-border/70 bg-zinc-950/98 p-3.5 animate-in slide-in-from-top-2 duration-150"
        >
          <CardConPanel
            entities={entities}
            onClose={() => setCardConModalOpen(false)}
            onInsert={handleInsertCardCon}
          />
        </div>
      )}

      {enableCardCon && cardConModalOpen && !isMobile && (
        <AnchoredConPopup
          anchor={cardConAnchor}
          triggerRef={cardConTriggerRef}
          onClose={() => setCardConModalOpen(false)}
          ariaLabel={cardConCopy.make}
          dataAttribute="data-card-con-popup"
          width={CARD_CON_POPUP_WIDTH}
          height={CARD_CON_POPUP_HEIGHT}
        >
          <CardConPanel
            entities={entities}
            onClose={() => setCardConModalOpen(false)}
            onInsert={handleInsertCardCon}
          />
        </AnchoredConPopup>
      )}

      {enableEmote && emoteOpen && isMobile && (
        <EmoteSheet
          locale={serviceLocale === "en" ? "en" : "ko"}
          onClose={() => setEmoteOpen(false)}
          onPick={handleInsertEmote}
        />
      )}

      {enableEmote && emoteOpen && !isMobile && (
        <AnchoredConPopup
          anchor={emoteAnchor}
          triggerRef={emoteTriggerRef}
          onClose={() => setEmoteOpen(false)}
          ariaLabel={emoteCopy.make}
          dataAttribute="data-emote-con-popup"
          width={EMOTE_DESKTOP_WHEEL_PX + 32}
          height={EMOTE_DESKTOP_WHEEL_PX + 32}
        >
          <EmoteWheel
            size={EMOTE_DESKTOP_WHEEL_PX}
            locale={serviceLocale === "en" ? "en" : "ko"}
            onPick={handleInsertEmote}
          />
        </AnchoredConPopup>
      )}
    </div>
  );
}

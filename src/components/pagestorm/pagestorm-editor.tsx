"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TableKit } from "@tiptap/extension-table/kit";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { exitSuggestion } from "@tiptap/suggestion";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useSitePathIndex } from "@/hooks/use-site-path-index";
import { useSts1MentionIndex } from "@/hooks/use-sts1-mention-index";
import { sts1MentionEntity, type Sts1MentionEntity } from "@/lib/sts1-mention-index";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { NavDropdownItem } from "@/lib/site-nav-items";
import { braceDisplayText } from "@/lib/rich-keyword-plain-text";
import { resolveYouTubeReference } from "@/lib/youtube-reference";
import {
  canonicalSitePath,
  localizedSiteHref,
  rankSitePaths,
  sitePathText,
  type SitePathEntry,
} from "@/lib/site-paths";
import { serviceMessages } from "@/messages/service";
import {
  PagestormColor,
  PagestormJitter,
  PagestormSine,
} from "./color-marks";
import { findPagestormEntity, PagestormEntitiesProvider } from "./entities-context";
import { EditorLinkBubble, EditorLinkClicks } from "@/components/editor/link-bubble";
import {
  CompendiumPickerModal,
  ToyboxPickerModal,
  majorFromCodexHref,
  type CompendiumInsertPayload,
} from "./pickers";
import { PagestormInternalLink, pagestormInternalLinkContent } from "./internal-link-node";
import { createPagestormPathSuggestion, pagestormPathPluginKey } from "./path-suggestion";
import { createPagestormBraceSuggestion, pagestormBracePluginKey } from "./prefix-menu";
import {
  PAGESTORM_BODY_MAX_CHARS,
  PAGESTORM_TITLE_MAX_CHARS,
  pagestormContentText,
  type PagestormDoc,
} from "@/lib/pagestorm";
import { assetFromEntity, PAGESTORM_EMPTY_DOC, resolvePastedUrl } from "./sample";
import {
  PagestormDetails,
  PagestormDetailsContent,
  PagestormDetailsSummary,
} from "./details";
import { EXTERNAL_LINK_ATTRS, insertExternalLink } from "./external-link";
import { ExternalLinkOgTip } from "./external-link-tip";
import { PagestormLinkSheet, selectionTouchesInternalLink } from "./link-sheet";
import { pagestormMentionContent, replacePagestormMentions } from "./mentions";
import { PagestormMention } from "./mention-node";
import { Sts1CompendiumPickerModal, sts1ResourceFromHref } from "./sts1-picker";
import { PagestormTableControls } from "./table-controls";
import {
  markdownLinkBeforeCursor,
  migratePagestormDoc,
  openingCodeFence,
  pagestormPasteContent,
} from "./markdown-blocks";
import {
  GameAssetNode,
  PagestormLightSection,
  ToyboxEmbedNode,
  YoutubePlayerNode,
  gameAssetAttrs,
} from "./tiptap-nodes";
import { AssetRowNode, PagestormAssetLayout } from "./asset-layout";
import { PagestormStickyToolbar } from "./toolbar";
import {
  pagestormToyboxNodeAttrs,
  type PagestormToyboxSnapshot,
} from "@/lib/pagestorm-toybox";
import "./pagestorm-editor.css";

export type PagestormEditorSaveInput = {
  title: string;
  nickname: string;
  content: PagestormDoc;
  contentText: string;
};

function applyCodeFence(view: EditorView): boolean {
  const { state } = view;
  const { $from, empty } = state.selection;
  if (!empty) return false;
  const parent = $from.parent;

  if (parent.type.name === "paragraph") {
    const opening = openingCodeFence(parent.textContent);
    const codeBlock = state.schema.nodes.codeBlock;
    if (!opening || !codeBlock) return false;
    const start = $from.before();
    const node = codeBlock.create({ language: opening.language || null });
    const tr = state.tr.replaceWith(start, $from.after(), node);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, start + 1)));
    return true;
  }

  if (parent.type.name !== "codeBlock") return false;
  const text = parent.textContent;
  const offset = $from.parentOffset;
  const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const nextBreak = text.indexOf("\n", offset);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  if (offset !== lineEnd || text.slice(lineStart, lineEnd) !== "```") return false;

  const blockStart = $from.start();
  const deleteFrom = blockStart + lineStart - (lineStart > 0 ? 1 : 0);
  const deleteTo = blockStart + lineEnd;
  let tr = state.tr.delete(deleteFrom, deleteTo);
  const $deleted = tr.doc.resolve(deleteFrom);
  if ($deleted.parent.type.name !== "codeBlock") {
    view.dispatch(tr);
    return true;
  }
  if ($deleted.parent.textContent.length === 0) {
    const paragraph = state.schema.nodes.paragraph.create();
    const from = $deleted.before();
    tr = tr.replaceWith(from, $deleted.after(), paragraph);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 1)));
    return true;
  }
  const after = $deleted.after();
  const paragraph = state.schema.nodes.paragraph.create();
  tr = tr.insert(after, paragraph);
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
  return true;
}

export function PagestormEditor({
  mode = "edit",
  initialContent,
  title,
  onTitleChange,
  nickname,
  onNicknameChange,
  submitLabel,
  draftLabel,
  deleteLabel,
  submitting = false,
  onSubmit,
  onDraft,
  onDelete,
  onDocumentChange,
}: {
  mode?: "edit" | "preview";
  initialContent?: PagestormDoc;
  title?: string;
  onTitleChange?: (title: string) => void;
  nickname?: string;
  onNicknameChange?: (nickname: string) => void;
  submitLabel?: string;
  draftLabel?: string;
  deleteLabel?: string;
  submitting?: boolean;
  onSubmit?: (input: PagestormEditorSaveInput) => Promise<void> | void;
  onDraft?: (input: PagestormEditorSaveInput) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onDocumentChange?: (input: PagestormEditorSaveInput) => void;
}) {
  const { entities } = useCommentEntities();
  const { index: sitePathIndex } = useSitePathIndex();
  const { index: sts1Index } = useSts1MentionIndex();
  const sts1Entities = useMemo(
    () => (sts1Index?.entries ?? []).map(sts1MentionEntity),
    [sts1Index],
  );
  const allEntities = useMemo(() => [...entities, ...sts1Entities], [entities, sts1Entities]);
  const resolveLinkEntity = useCallback(
    (type: string, id: string) => findPagestormEntity(allEntities, type, id),
    [allEntities],
  );
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const entitiesRef = useRef(entities);
  const sts1Ref = useRef<Sts1MentionEntity[]>(sts1Entities);
  const localeRef = useRef(serviceLocale);
  const pathsRef = useRef<SitePathEntry[]>([]);
  const [compendiumMajor, setCompendiumMajor] = useState<ReturnType<typeof majorFromCodexHref> | "closed">("closed");
  const [sts1Resource, setSts1Resource] = useState<ReturnType<typeof sts1ResourceFromHref> | "closed">("closed");
  const [linkArmed, setLinkArmed] = useState(false);
  const [toyboxHref, setToyboxHref] = useState<string | null | "closed">("closed");
  const editorRef = useRef<Editor | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  useEffect(() => {
    sts1Ref.current = sts1Entities;
  }, [sts1Entities]);

  useEffect(() => {
    localeRef.current = serviceLocale;
  }, [serviceLocale]);

  useEffect(() => {
    pathsRef.current = sitePathIndex?.entries ?? [];
  }, [sitePathIndex]);

  function internalLinkFromPath(href: string, label?: string) {
    const locale = localeRef.current;
    const canonical = canonicalSitePath(href) ?? href;
    const entry = pathsRef.current.find((item) => item.href === canonical);
    if (entry) {
      return pagestormInternalLinkContent({
        href: localizedSiteHref(entry.href, locale),
        label: label?.trim() || sitePathText(entry, locale, "label"),
        title: sitePathText(entry, locale, "title"),
        preview: sitePathText(entry, locale, "preview"),
        ogImage: entry.ogImage,
        ogImageAlt: locale === "en" ? entry.ogImageAltEn : entry.ogImageAltKo,
      });
    }
    const visible = label?.trim() || canonical;
    return pagestormInternalLinkContent({
      href: localizedSiteHref(canonical, locale),
      label: visible,
      title: visible,
      preview: "",
    });
  }

  /* eslint-disable react-hooks/refs -- suggestion getters run on keystroke, not render */
  const brace = useMemo(
    () => createPagestormBraceSuggestion({
      getEntities: () => entitiesRef.current,
      getSts1Entities: () => sts1Ref.current,
      onPick: ({ entity, range }) => {
        const current = editorRef.current;
        if (!current) return;
        exitSuggestion(current.view, pagestormBracePluginKey);
        const display = braceDisplayText(current.state.doc.textBetween(range.from, range.to));
        current.chain().focus().insertContentAt(range, pagestormMentionContent(entity, display ?? entity.nameKo)).run();
      },
    }),
    [],
  );
  const paths = useMemo(
    () => createPagestormPathSuggestion({
      getEntries: () => pathsRef.current,
      getLocale: () => localeRef.current,
      getEmptyLabel: () => serviceMessages[localeRef.current].pagestorm.pathEmpty,
      rank: rankSitePaths,
      onPick: ({ entry, range }) => {
        const current = editorRef.current;
        if (!current) return;
        if (entry.action === "drill") {
          current.chain().focus().insertContentAt(range, entry.href).run();
          return;
        }
        exitSuggestion(current.view, pagestormPathPluginKey);
        const locale = localeRef.current;
        current.chain().focus().insertContentAt(range, pagestormInternalLinkContent({
          href: localizedSiteHref(entry.href, locale),
          label: sitePathText(entry, locale, "label"),
          title: sitePathText(entry, locale, "title"),
          preview: sitePathText(entry, locale, "preview"),
          ogImage: entry.ogImage,
          ogImageAlt: locale === "en" ? entry.ogImageAltEn : entry.ogImageAltKo,
        })).run();
      },
    }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const [docTick, setDocTick] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    editable: mode === "edit",
    content: migratePagestormDoc((initialContent ?? PAGESTORM_EMPTY_DOC) as JSONContent),
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          // Tiptap 3 maps "whenNotEditable" to opening on click *while*
          // editing. EditorLinkClicks owns clicks in the editor; read-only
          // documents are plain anchors.
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { ...EXTERNAL_LINK_ATTRS },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({
        table: { resizable: true, renderWrapper: true },
      }),
      PagestormDetails,
      PagestormDetailsSummary,
      PagestormDetailsContent,
      PagestormColor,
      PagestormSine,
      PagestormJitter,
      GameAssetNode,
      YoutubePlayerNode,
      ToyboxEmbedNode,
      AssetRowNode,
      PagestormAssetLayout,
      PagestormLightSection,
      PagestormMention,
      PagestormInternalLink,
      EditorLinkClicks,
      brace,
      paths,
    ],
    editorProps: {
      attributes: {
        class: "pagestorm-mock-editor",
      },
      handleKeyDown: (view, event) => {
        if (mode !== "edit") return false;
        if (event.key === "Enter" && !event.shiftKey && applyCodeFence(view)) {
          event.preventDefault();
          return true;
        }
        if (event.key !== "Tab") return false;
        const current = editorRef.current;
        if (!current) return false;
        const { $from } = current.state.selection;
        let inList = false;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === "listItem") inList = true;
        }
        if (!inList) return false;
        event.preventDefault();
        if (event.shiftKey) current.commands.liftListItem("listItem");
        else current.commands.sinkListItem("listItem");
        return true;
      },
      handleTextInput: (view, from, to, text) => {
        if (mode !== "edit") return false;
        const $from = view.state.doc.resolve(from);
        if (!$from.parent.isTextblock) return false;
        const blockStart = $from.start();
        const textBefore = $from.parent.textBetween(
          Math.max(0, from - blockStart - 2000),
          from - blockStart,
          undefined,
          "\ufffc",
        );
        const found = markdownLinkBeforeCursor(textBefore, text);
        const labeled = found ? null : `${textBefore}${text}`.match(/\[([^\]\n]+)\]\((\/[^\s)]+)\)$/);
        if (labeled?.[2] && canonicalSitePath(labeled[2])) {
          const linkNode = view.state.schema.nodes.pagestormInternalLink;
          if (!linkNode) return false;
          const content = internalLinkFromPath(labeled[2], labeled[1]);
          const start = from - (labeled[0].length - text.length);
          view.dispatch(view.state.tr.replaceWith(start, to, linkNode.create(content.attrs)));
          return true;
        }
        if (!found) return false;
        const link = view.state.schema.marks.link;
        if (!link) return false;
        const start = from - found.fromOffset;
        view.dispatch(view.state.tr.replaceWith(
          start,
          to,
          view.state.schema.text(found.label, [link.create({
            href: found.href,
            ...EXTERNAL_LINK_ATTRS,
          })]),
        ));
        return true;
      },
      handlePaste: (_view, event) => {
        if (mode !== "edit") return false;
        const pastedText = event.clipboardData?.getData("text/plain").trim() ?? "";
        const current = editorRef.current;
        const pastedBlocks = pagestormPasteContent(pastedText);
        if (pastedBlocks && current) {
          event.preventDefault();
          current.chain().focus().insertContent(pastedBlocks).run();
          return true;
        }
        const pastedPath = canonicalSitePath(pastedText);
        if (pastedPath && current) {
          event.preventDefault();
          current.chain().focus().insertContent(internalLinkFromPath(pastedPath)).run();
          return true;
        }
        const resolved = resolvePastedUrl(pastedText);
        if (!resolved) return false;
        event.preventDefault();
        if (!current) return true;
        if (resolved.kind === "og") {
          insertExternalLink(current, resolved.bookmark.url, resolved.bookmark.title || resolved.bookmark.url);
          return true;
        }
        const pendingLabel = copy.youtubePending;
        current.chain().focus().insertContent([
          {
            type: "youtubePlayer",
            attrs: { videoId: resolved.videoId, title: pendingLabel, align: "center" },
          },
          { type: "paragraph" },
        ]).run();
        void resolveYouTubeReference(pastedText)
          .then((reference) => {
            const current = editorRef.current;
            if (!current || current.isDestroyed) return;
            current.view.state.doc.descendants((node, position) => {
              if (
                node.type.name === "youtubePlayer"
                && node.attrs.videoId === resolved.videoId
                && node.attrs.title === pendingLabel
              ) {
                current.view.dispatch(current.view.state.tr.setNodeMarkup(position, undefined, {
                  ...node.attrs,
                  videoId: reference.videoId,
                  title: reference.title,
                }));
              }
            });
          })
          .catch(() => undefined);
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const replace = () => {
      replacePagestormMentions(editor, entitiesRef.current, sts1Ref.current);
    };
    editor.on("update", replace);
    return () => {
      editor.off("update", replace);
    };
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(mode === "edit");
  }, [editor, mode]);

  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => setDocTick((current) => current + 1);
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  function insertEntity(
    entity: EntityInfo,
    options: { presentation: CompendiumInsertPayload["presentation"]; beta: boolean },
    range?: { from: number; to: number },
  ) {
    const current = editorRef.current;
    if (!current) return;
    const chain = current.chain().focus();
    if (range) chain.deleteRange(range);
    chain.insertContent([
      { type: "gameAsset", attrs: gameAssetAttrs(assetFromEntity(entity), options) },
      { type: "paragraph" },
    ]).run();
    current.chain().selectNodeBackward().run();
  }

  function insertToybox(snapshot: PagestormToyboxSnapshot) {
    const current = editorRef.current;
    if (!current) return;
    current.chain().focus().insertContent([
      {
        type: "toyboxEmbed",
        attrs: pagestormToyboxNodeAttrs(snapshot),
      },
      { type: "paragraph" },
    ]).run();
  }

  function onCompendium(item: NavDropdownItem) {
    setCompendiumMajor(majorFromCodexHref(item.href));
  }

  function onSts1(item: NavDropdownItem) {
    setSts1Resource(sts1ResourceFromHref(item.href));
  }

  function onToybox(item: NavDropdownItem) {
    setToyboxHref(item.href.replace(/^\/(?:en)(?=\/)/, ""));
  }

  const editing = mode === "edit";
  const titleValue = title ?? "";
  const nicknameValue = nickname ?? "";
  const contentText = editor
    ? pagestormContentText(editor.getJSON() as PagestormDoc)
    : "";
  const canSubmit = Boolean(
    editor
    && onSubmit
    && titleValue.trim().length >= 1
    && titleValue.trim().length <= PAGESTORM_TITLE_MAX_CHARS
    && nicknameValue.trim().length >= 1
    && nicknameValue.trim().length <= 20
    && !editor.isEmpty
    && contentText.length >= 1
    && contentText.length <= PAGESTORM_BODY_MAX_CHARS
    && !submitting
    && docTick >= 0,
  );
  const validation = [
    titleValue.trim().length < 1 ? copy.needTitle : "",
    contentText.trim().length < 1 ? copy.needBody : "",
  ].filter(Boolean);

  const currentSaveInput = useCallback((): PagestormEditorSaveInput | null => {
    const current = editorRef.current;
    if (!current) return null;
    const content = current.getJSON() as PagestormDoc;
    return {
      title: titleValue.trim(),
      nickname: nicknameValue.trim(),
      content,
      contentText: pagestormContentText(content),
    };
  }, [titleValue, nicknameValue]);

  useEffect(() => {
    const input = currentSaveInput();
    if (input) onDocumentChange?.(input);
  }, [contentText, currentSaveInput, onDocumentChange]);

  async function handleSubmit() {
    const input = currentSaveInput();
    if (!input || !onSubmit || !canSubmit) return;
    await onSubmit(input);
  }

  async function handleDraft() {
    const input = currentSaveInput();
    if (!input || !onDraft || !canSubmit) return;
    await onDraft(input);
  }

  return (
    <PagestormEntitiesProvider entities={allEntities} mode={mode}>
      <div className="space-y-3">
        {editing && onTitleChange ? (
          <div className="space-y-2">
            {onNicknameChange ? (
              <input
                type="text"
                value={nicknameValue}
                onChange={(event) => onNicknameChange(event.target.value.slice(0, 20))}
                placeholder={copy.nicknamePlaceholder}
                maxLength={20}
                className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder:text-gray-600"
              />
            ) : null}
            <input
              type="text"
              value={titleValue}
              onChange={(event) => onTitleChange(event.target.value.slice(0, PAGESTORM_TITLE_MAX_CHARS))}
              placeholder={copy.titlePlaceholder}
              maxLength={PAGESTORM_TITLE_MAX_CHARS}
              className="w-full bg-transparent font-game-title text-2xl text-foreground outline-none placeholder:text-gray-600"
            />
          </div>
        ) : null}
        <div
          ref={frameRef}
          className="pagestorm-editor-frame relative w-full min-w-0 max-w-full overflow-visible rounded-lg border border-border bg-card"
        >
        {editing && editor ? (
          <PagestormStickyToolbar
            editor={editor}
            linkArmed={linkArmed}
            onEditLink={() => {
              if (selectionTouchesInternalLink(editor)) return;
              setLinkArmed(true);
            }}
            onCompendium={onCompendium}
            onSts1={onSts1}
            onToybox={onToybox}
          />
        ) : null}
        {editing && editor ? (
          <PagestormTableControls editor={editor} frameRef={frameRef} />
        ) : null}
        {editor ? (
          <ExternalLinkOgTip editor={editor} />
        ) : null}
        {editing && editor ? (
          <EditorLinkBubble editor={editor} resolveEntity={resolveLinkEntity} />
        ) : null}
        {editing && editor ? (
          <PagestormLinkSheet
            editor={editor}
            frameRef={frameRef}
            armed={linkArmed}
            onClose={() => setLinkArmed(false)}
          />
        ) : null}
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{copy.editorLoading}</p>
        )}
        {editing ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {copy.braceHint}
            </p>
            {onSubmit && submitLabel ? (
              <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {!canSubmit && validation.length > 0 ? (
                  <span className="text-[11px] text-muted-foreground" data-pagestorm-validation="">
                    {validation.join(" ")}
                  </span>
                ) : null}
                {onDelete && deleteLabel ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => { void onDelete(); }}
                    className="inline-flex items-center rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-50"
                  >
                    {deleteLabel}
                  </button>
                ) : null}
                {onDraft && draftLabel ? (
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => { void handleDraft(); }}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                  >
                    {draftLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => { void handleSubmit(); }}
                  className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
                >
                  {submitLabel}
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
      {mode === "edit" && compendiumMajor !== "closed" ? (
        <CompendiumPickerModal
          entities={entities}
          initialMajor={compendiumMajor}
          onClose={() => setCompendiumMajor("closed")}
          onInsert={(payload) => {
            insertEntity(payload.entity, payload);
            setCompendiumMajor("closed");
          }}
        />
      ) : null}
      {mode === "edit" && sts1Resource !== "closed" ? (
        <Sts1CompendiumPickerModal
          initialResource={sts1Resource}
          onClose={() => setSts1Resource("closed")}
          onInsert={(entry) => {
            insertEntity(sts1MentionEntity(entry), {
              presentation: entry.entityType === "card" ? "tile" : "art",
              beta: false,
            });
            setSts1Resource("closed");
          }}
        />
      ) : null}
      {mode === "edit" && toyboxHref !== "closed" ? (
        <ToyboxPickerModal
          initialServiceHref={toyboxHref}
          onClose={() => setToyboxHref("closed")}
          onInsert={(post) => {
            insertToybox(post);
            setToyboxHref("closed");
          }}
        />
      ) : null}
    </PagestormEntitiesProvider>
  );
}

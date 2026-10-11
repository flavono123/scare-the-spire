"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TableKit } from "@tiptap/extension-table/kit";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { exitSuggestion } from "@tiptap/suggestion";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useSts1MentionIndex } from "@/hooks/use-sts1-mention-index";
import { sts1MentionEntity, type Sts1MentionEntity } from "@/lib/sts1-mention-index";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { NavDropdownItem } from "@/lib/site-nav-items";
import { resolveYouTubeReference } from "@/lib/youtube-reference";
import { serviceMessages } from "@/messages/service";
import {
  PagestormColor,
  PagestormJitter,
  PagestormSine,
} from "./color-marks";
import { PagestormEntitiesProvider } from "./entities-context";
import {
  CompendiumPickerModal,
  ToyboxPickerModal,
  majorFromCodexHref,
  type CompendiumInsertPayload,
} from "./pickers";
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
import { PagestormLinkSheet } from "./link-sheet";
import { pagestormMentionContent, replacePagestormMentions } from "./mentions";
import { PagestormMention } from "./mention-node";
import { Sts1CompendiumPickerModal, sts1ResourceFromHref } from "./sts1-picker";
import { PagestormTableControls } from "./table-controls";
import {
  markdownLinkBeforeCursor,
  migratePagestormDoc,
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

export function PagestormEditor({
  mode = "edit",
  initialContent,
  title,
  onTitleChange,
  nickname,
  onNicknameChange,
  submitLabel,
  submitting = false,
  onSubmit,
}: {
  mode?: "edit" | "preview";
  initialContent?: PagestormDoc;
  title?: string;
  onTitleChange?: (title: string) => void;
  nickname?: string;
  onNicknameChange?: (nickname: string) => void;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit?: (input: PagestormEditorSaveInput) => Promise<void> | void;
}) {
  const { entities } = useCommentEntities();
  const { index: sts1Index } = useSts1MentionIndex();
  const sts1Entities = useMemo(
    () => (sts1Index?.entries ?? []).map(sts1MentionEntity),
    [sts1Index],
  );
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const entitiesRef = useRef(entities);
  const sts1Ref = useRef<Sts1MentionEntity[]>(sts1Entities);
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

  /* eslint-disable react-hooks/refs -- suggestion getters run on keystroke, not render */
  const brace = useMemo(
    () => createPagestormBraceSuggestion({
      getEntities: () => entitiesRef.current,
      getSts1Entities: () => sts1Ref.current,
      onPick: ({ entity, range }) => {
        const current = editorRef.current;
        if (!current) return;
        exitSuggestion(current.view, pagestormBracePluginKey);
        const parsed = entity.nameKo;
        current.chain().focus().insertContentAt(range, pagestormMentionContent(entity, parsed)).run();
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
          openOnClick: "whenNotEditable",
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
            class: "pagestorm-inline-link",
          },
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
      brace,
    ],
    editorProps: {
      attributes: {
        class: "pagestorm-mock-editor",
      },
      handleKeyDown: (_view, event) => {
        if (event.key !== "Tab" || mode !== "edit") return false;
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
        if (!found) return false;
        const link = view.state.schema.marks.link;
        if (!link) return false;
        const start = from - found.fromOffset;
        view.dispatch(view.state.tr.replaceWith(
          start,
          to,
          view.state.schema.text(found.label, [link.create({
            href: found.href,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "pagestorm-inline-link",
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
        const resolved = resolvePastedUrl(pastedText);
        if (!resolved) return false;
        event.preventDefault();
        if (!current) return true;
        if (resolved.kind === "og") {
          current.chain().focus().insertContent({
            type: "text",
            text: resolved.bookmark.title || resolved.bookmark.url,
            marks: [{
              type: "link",
              attrs: {
                href: resolved.bookmark.url,
                target: "_blank",
                rel: "noopener noreferrer",
                class: "pagestorm-inline-link",
              },
            }],
          }).run();
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

  async function handleSubmit() {
    const current = editorRef.current;
    if (!current || !onSubmit || !canSubmit) return;
    const content = current.getJSON() as PagestormDoc;
    await onSubmit({
      title: titleValue.trim(),
      nickname: nicknameValue.trim(),
      content,
      contentText: pagestormContentText(content),
    });
  }

  return (
    <PagestormEntitiesProvider entities={[...entities, ...sts1Entities]} mode={mode}>
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
            onEditLink={() => setLinkArmed(true)}
            onCompendium={onCompendium}
            onSts1={onSts1}
            onToybox={onToybox}
          />
        ) : null}
        {editing && editor ? (
          <PagestormTableControls editor={editor} frameRef={frameRef} />
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
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => { void handleSubmit(); }}
                className="inline-flex shrink-0 items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
              >
                {submitLabel}
              </button>
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

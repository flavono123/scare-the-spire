"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { exitSuggestion } from "@tiptap/suggestion";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
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
import { assetFromEntity, PAGESTORM_EMPTY_DOC, pagestormLoremDoc, resolvePastedUrl } from "./sample";
import {
  GameAssetNode,
  OgBookmarkNode,
  PagestormLightSection,
  ToyboxEmbedNode,
  YoutubePlayerNode,
  gameAssetAttrs,
} from "./tiptap-nodes";
import { PagestormStickyToolbar } from "./toolbar";
import type { PagestormToyboxPost } from "./toybox-samples";
import "./pagestorm-editor.css";

export type PagestormEditorSaveInput = {
  title: string;
  nickname: string;
  content: PagestormDoc;
  contentText: string;
};

export function PagestormEditor({
  mode = "edit",
  seed = "empty",
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
  seed?: "empty" | "lorem";
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
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const entitiesRef = useRef(entities);
  const [compendiumMajor, setCompendiumMajor] = useState<ReturnType<typeof majorFromCodexHref> | "closed">("closed");
  const [toyboxHref, setToyboxHref] = useState<string | null | "closed">("closed");
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  /* eslint-disable react-hooks/refs -- suggestion getters run on keystroke, not render */
  const brace = useMemo(
    () => createPagestormBraceSuggestion({
      getEntities: () => entitiesRef.current,
      onPick: ({ entity, range }) => {
        const current = editorRef.current;
        if (current) exitSuggestion(current.view, pagestormBracePluginKey);
        insertEntity(entity, {
          presentation: entity.type === "card" ? "tile" : "art",
          beta: false,
        }, range);
      },
    }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const [docTick, setDocTick] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    editable: mode === "edit",
    content: initialContent ?? (seed === "lorem" ? pagestormLoremDoc(copy) : PAGESTORM_EMPTY_DOC),
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      PagestormColor,
      PagestormSine,
      PagestormJitter,
      GameAssetNode,
      YoutubePlayerNode,
      OgBookmarkNode,
      ToyboxEmbedNode,
      PagestormLightSection,
      brace,
    ],
    editorProps: {
      attributes: {
        class: "pagestorm-mock-editor",
      },
      handlePaste: (_view, event) => {
        if (mode !== "edit") return false;
        const pastedText = event.clipboardData?.getData("text/plain").trim() ?? "";
        const resolved = resolvePastedUrl(pastedText);
        if (!resolved) return false;
        event.preventDefault();
        const current = editorRef.current;
        if (!current) return true;
        if (resolved.kind === "og") {
          current.chain().focus().insertContent([
            {
              type: "ogBookmark",
              attrs: {
                url: resolved.bookmark.url,
                title: resolved.bookmark.title,
                description: resolved.bookmark.description,
                image: resolved.bookmark.image,
                siteName: resolved.bookmark.siteName,
                align: "center",
              },
            },
            { type: "paragraph" },
          ]).run();
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
  }

  function insertToybox(post: PagestormToyboxPost) {
    const current = editorRef.current;
    if (!current) return;
    current.chain().focus().insertContent([
      {
        type: "toyboxEmbed",
        attrs: {
          postId: post.id,
          service: post.service,
          align: "center",
          linked: true,
          width: 576,
          height: post.service === "/this-or-that" ? 320 : 280,
        },
      },
      { type: "paragraph" },
    ]).run();
  }

  function onCompendium(item: NavDropdownItem) {
    setCompendiumMajor(majorFromCodexHref(item.href));
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
    <PagestormEntitiesProvider entities={entities} mode={mode}>
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
        <div className="overflow-visible rounded-lg border border-border bg-card">
        {editing && editor ? (
          <PagestormStickyToolbar
            editor={editor}
            onCompendium={onCompendium}
            onToybox={onToybox}
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

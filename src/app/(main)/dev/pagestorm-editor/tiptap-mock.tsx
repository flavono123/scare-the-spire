"use client";

import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignButtons,
  InsertBar,
  MarkToolbar,
  mockButtonClass,
} from "./insert-bar";
import {
  GameAssetNode,
  OgBookmarkNode,
  YoutubePlayerNode,
  gameAssetAttrs,
} from "./tiptap-nodes";
import { TIPTAP_SEED } from "./tiptap-seed";
import "./pagestorm-mock-editor.css";

function MarkButtons({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return (
    <>
      <button
        type="button"
        className={mockButtonClass(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </button>
      <button
        type="button"
        className={mockButtonClass(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </button>
      <button
        type="button"
        className={mockButtonClass(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        type="button"
        className={mockButtonClass(editor.isActive("heading", { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>
      <button
        type="button"
        className={mockButtonClass(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        목록
      </button>
      <button
        type="button"
        className={mockButtonClass(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        인용
      </button>
      <button
        type="button"
        className={mockButtonClass()}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        구분선
      </button>
      <AlignButtons
        value={
          editor.isActive({ textAlign: "center" })
            ? "center"
            : editor.isActive({ textAlign: "right" })
              ? "right"
              : "left"
        }
        onChange={(align) => editor.chain().focus().setTextAlign(align).run()}
      />
    </>
  );
}

export function TiptapPagestormMock({ chrome }: { chrome: "toolbar" | "bubble" }) {
  const editor = useEditor({
    immediatelyRender: false,
    content: TIPTAP_SEED,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      GameAssetNode,
      YoutubePlayerNode,
      OgBookmarkNode,
    ],
    editorProps: {
      attributes: {
        class: "pagestorm-mock-editor",
      },
    },
  });

  if (!editor) {
    return <p className="p-4 text-sm text-muted-foreground">에디터 준비 중…</p>;
  }

  const insert = {
    onInsertAsset: (asset: Parameters<typeof gameAssetAttrs>[0]) => {
      editor.chain().focus().insertContent({ type: "gameAsset", attrs: gameAssetAttrs(asset) }).run();
    },
    onInsertYoutube: (videoId: string, title: string) => {
      editor.chain().focus().insertContent({
        type: "youtubePlayer",
        attrs: { videoId, title, align: "center" },
      }).run();
    },
    onInsertOg: (bookmark: {
      url: string;
      title: string;
      description: string;
      image: string | null;
      siteName: string;
    }) => {
      editor.chain().focus().insertContent({
        type: "ogBookmark",
        attrs: { ...bookmark, align: "center" },
      }).run();
    },
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/20">
      {chrome === "toolbar" ? (
        <>
          <MarkToolbar>
            <MarkButtons editor={editor} />
          </MarkToolbar>
          <InsertBar {...insert} />
        </>
      ) : (
        <InsertBar {...insert} />
      )}

      {chrome === "bubble" ? (
        <>
          <BubbleMenu editor={editor} className="pagestorm-mock-bubble">
            <MarkButtons editor={editor} />
          </BubbleMenu>
          <FloatingMenu editor={editor} className="pagestorm-mock-bubble">
            <button
              type="button"
              className={mockButtonClass()}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </button>
            <button
              type="button"
              className={mockButtonClass()}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              목록
            </button>
            <button
              type="button"
              className={mockButtonClass()}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              인용
            </button>
          </FloatingMenu>
        </>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}

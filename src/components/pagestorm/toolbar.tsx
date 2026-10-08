"use client";

import { getMarkRange } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useState } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  Minus,
  Quote,
  Strikethrough,
  Table,
  UnfoldVertical,
  Waves,
  Zap,
} from "lucide-react";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { tierColorBar } from "@/lib/decisions-decisions";
import { serviceMessages } from "@/messages/service";
import {
  PAGESTORM_CHARACTER_COLOR_KEYS,
  PAGESTORM_SPIRE_COLOR_KEYS,
  type PagestormColorKey,
} from "./color-marks";
import { togglePagestormBlockquote } from "./blockquote";
import { AlignButtons, IconTipButton } from "./figures";
import { PickerNavDropdown } from "./nav-tokens";
import { useCompendiumNavItems, useToyboxNavItems } from "./pickers";
import { normalizeHttpUrl } from "./markdown-blocks";
import type { MockAlign } from "./sample";
import { PAGESTORM_BLOCK_NODE_NAMES } from "./tiptap-nodes";
import type { NavDropdownItem } from "@/lib/site-nav-items";

function asAlign(value: unknown): MockAlign {
  return value === "center" || value === "right" ? value : "left";
}

function selectedBlockAlign(editor: Editor): MockAlign | null {
  for (const name of PAGESTORM_BLOCK_NODE_NAMES) {
    if (editor.isActive(name)) {
      return asAlign(editor.getAttributes(name).align);
    }
  }
  return null;
}

function applyAlign(editor: Editor, align: MockAlign) {
  for (const name of PAGESTORM_BLOCK_NODE_NAMES) {
    if (editor.isActive(name)) {
      editor.chain().updateAttributes(name, { align }).run();
      return;
    }
  }
  editor.chain().focus().setTextAlign(align).run();
}

function currentTextAlign(editor: Editor): MockAlign {
  const blockAlign = selectedBlockAlign(editor);
  if (blockAlign) return blockAlign;
  if (editor.isActive({ textAlign: "center" })) return "center";
  if (editor.isActive({ textAlign: "right" })) return "right";
  return "left";
}

function editorChromeSnapshot(editor: Editor) {
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    heading2: editor.isActive("heading", { level: 2 }),
    heading3: editor.isActive("heading", { level: 3 }),
    bulletList: editor.isActive("bulletList"),
    blockquote: editor.isActive("blockquote"),
    link: editor.isActive("link"),
    table: editor.isActive("table"),
    details: editor.isActive("details"),
    sine: editor.isActive("sine"),
    jitter: editor.isActive("jitter"),
    colorKey: editor.getAttributes("pagestormColor").colorKey as string | undefined,
    align: currentTextAlign(editor),
  };
}

function currentLink(editor: Editor): { from: number; to: number; title: string; url: string } | null {
  const type = editor.state.schema.marks.link;
  if (!type) return null;
  const { from, to, empty, $from } = editor.state.selection;
  if (!empty && !editor.isActive("link")) {
    return { from, to, title: editor.state.doc.textBetween(from, to, " "), url: "" };
  }
  const range = getMarkRange($from, type);
  if (!range) return null;
  const mark = type.isInSet(editor.state.doc.resolve(Math.min(range.from + 1, range.to)).marks());
  return {
    from: range.from,
    to: range.to,
    title: editor.state.doc.textBetween(range.from, range.to, " "),
    url: String(mark?.attrs.href ?? ""),
  };
}

function applyPagestormLink(editor: Editor, title: string, url: string) {
  const href = normalizeHttpUrl(url);
  const range = currentLink(editor);
  const from = range?.from ?? editor.state.selection.from;
  const to = range?.to ?? editor.state.selection.to;
  if (!href) {
    if (editor.isActive("link")) editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().insertContentAt({ from, to }, {
    type: "text",
    text: title.trim() || href,
    marks: [{
      type: "link",
      attrs: {
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "pagestorm-inline-link",
      },
    }],
  }).run();
}

function LinkPhraseForm({ editor }: { editor: Editor }) {
  const copy = serviceMessages[useServiceLocale()].pagestorm;
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: current }) => currentLink(current) ?? {
      from: current.state.selection.from,
      to: current.state.selection.to,
      title: "",
      url: "",
    },
  });
  const key = `${snapshot.from}:${snapshot.to}:${snapshot.url}`;
  const [seen, setSeen] = useState(key);
  const [title, setTitle] = useState(snapshot.title);
  const [url, setUrl] = useState(snapshot.url);
  if (seen !== key) {
    setSeen(key);
    setTitle(snapshot.title);
    setUrl(snapshot.url);
  }
  return (
    <div
      className="flex min-w-[12rem] max-w-full flex-col gap-1.5 rounded-md border border-border bg-card px-2 py-2 shadow-md sm:max-w-sm"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        applyPagestormLink(editor, title, url);
      }}
    >
      <label className="block text-[10px] font-medium text-muted-foreground">
        {copy.linkPhrase}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
        />
      </label>
      <label className="block text-[10px] font-medium text-muted-foreground">
        {copy.linkUrl}
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
        />
      </label>
    </div>
  );
}

function applyColor(editor: Editor, colorKey: PagestormColorKey) {
  const current = editor.getAttributes("pagestormColor").colorKey;
  if (current === colorKey) {
    editor.chain().focus().unsetMark("pagestormColor").run();
    return;
  }
  editor.chain().focus().setMark("pagestormColor", { colorKey }).run();
}

function ColorSwatches({
  editor,
  keys,
  prefix,
  labels,
  active,
}: {
  editor: Editor;
  keys: readonly string[];
  prefix: "spire" | "character";
  labels: Record<string, string>;
  active?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((key) => {
        const colorKey = `${prefix}-${key}` as PagestormColorKey;
        const label = labels[key] ?? key;
        return (
          <GameUiHoverTip key={colorKey} label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
            <button
              type="button"
              aria-label={label}
              className={`h-4 w-4 rounded-sm border ${
                active === colorKey ? "ring-2 ring-foreground" : "border-black/40"
              }`}
              style={{ background: tierColorBar(key as Parameters<typeof tierColorBar>[0]) }}
              onClick={() => applyColor(editor, colorKey)}
            />
          </GameUiHoverTip>
        );
      })}
    </span>
  );
}

export function PagestormFormatChrome({
  editor,
  onCompendium,
  onToybox,
}: {
  editor: Editor;
  onCompendium: (item: NavDropdownItem) => void;
  onToybox: (item: NavDropdownItem) => void;
}) {
  const [linkForm, setLinkForm] = useState(false);
  const chrome = useEditorState({
    editor,
    selector: ({ editor: current }) => editorChromeSnapshot(current),
  });
  const serviceLocale = useServiceLocale();
  const editorCopy = serviceMessages[serviceLocale].pagestorm;
  const compendiumItems = useCompendiumNavItems();
  const toyboxItems = useToyboxNavItems();

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <IconTipButton
          label={editorCopy.bold}
          active={chrome.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.italic}
          active={chrome.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.strike}
          active={chrome.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.link}
          active={chrome.link || linkForm}
          onClick={() => {
            if (chrome.link) {
              editor.chain().focus().unsetLink().run();
              setLinkForm(false);
              return;
            }
            setLinkForm((open) => !open);
          }}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.heading2}
          active={chrome.heading2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.heading3}
          active={chrome.heading3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.bulletList}
          active={chrome.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.sinkList}
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
        >
          <IndentIncrease className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.liftList}
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
        >
          <IndentDecrease className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.blockquote}
          active={chrome.blockquote}
          onClick={() => togglePagestormBlockquote(editor)}
        >
          <Quote className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.divider}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.table}
          active={chrome.table}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.details}
          active={chrome.details}
          onClick={() => {
            if (chrome.details) {
              editor.chain().focus().updateAttributes("details", {
                open: !editor.getAttributes("details").open,
              }).run();
              return;
            }
            editor.chain().focus().insertPagestormDetails(editorCopy.detailsSummary).run();
          }}
        >
          <UnfoldVertical className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        {chrome.table ? (
          <>
            <IconTipButton
              label={editorCopy.tableAddRow}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <span className="px-0.5 text-[10px] font-semibold">+R</span>
            </IconTipButton>
            <IconTipButton
              label={editorCopy.tableAddColumn}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <span className="px-0.5 text-[10px] font-semibold">+C</span>
            </IconTipButton>
            <IconTipButton
              label={editorCopy.tableDeleteRow}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <span className="px-0.5 text-[10px] font-semibold">-R</span>
            </IconTipButton>
            <IconTipButton
              label={editorCopy.tableDeleteColumn}
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <span className="px-0.5 text-[10px] font-semibold">-C</span>
            </IconTipButton>
            <IconTipButton
              label={editorCopy.tableDelete}
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              <span className="px-0.5 text-[10px] font-semibold">×</span>
            </IconTipButton>
          </>
        ) : null}
        <AlignButtons
          value={chrome.align}
          onChange={(align) => applyAlign(editor, align)}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ColorSwatches
          editor={editor}
          keys={PAGESTORM_SPIRE_COLOR_KEYS}
          prefix="spire"
          labels={editorCopy.spireColors}
          active={chrome.colorKey}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ColorSwatches
          editor={editor}
          keys={PAGESTORM_CHARACTER_COLOR_KEYS}
          prefix="character"
          labels={editorCopy.characterColors}
          active={chrome.colorKey}
        />
        <IconTipButton
          label={`${editorCopy.sine} · ${editorCopy.sineHint}`}
          active={chrome.sine}
          onClick={() => editor.chain().focus().toggleMark("sine").run()}
        >
          <Waves className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={`${editorCopy.jitter} · ${editorCopy.jitterHint}`}
          active={chrome.jitter}
          onClick={() => editor.chain().focus().toggleMark("jitter").run()}
        >
          <Zap className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
      </div>
      {linkForm || chrome.link ? <LinkPhraseForm editor={editor} /> : null}
      <hr className="border-border" />
      <div className="flex flex-wrap items-center gap-2">
        <PickerNavDropdown
          icon="/images/sts2/icons/app_icon.png"
          alt={editorCopy.imageInsert.replace("{name}", editorCopy.assetSection)}
          items={compendiumItems}
          onPick={onCompendium}
        />
        <PickerNavDropdown
          icon="/images/sts2/relics/toy_box.webp"
          alt={editorCopy.imageInsert.replace("{name}", editorCopy.toyboxSection)}
          items={toyboxItems}
          variant="toyBox"
          onPick={onToybox}
        />
      </div>
    </div>
  );
}

export function PagestormStickyToolbar({
  editor,
  onCompendium,
  onToybox,
}: {
  editor: Editor;
  onCompendium: (item: NavDropdownItem) => void;
  onToybox: (item: NavDropdownItem) => void;
}) {
  return (
    <div
      data-pagestorm-sticky-toolbar
      className="pagestorm-sticky-toolbar"
    >
      <PagestormFormatChrome
        editor={editor}
        onCompendium={onCompendium}
        onToybox={onToybox}
      />
    </div>
  );
}

"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  Minus,
  Quote,
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
import { AlignButtons, IconTipButton } from "./figures";
import { PickerNavDropdown } from "./nav-tokens";
import { useCompendiumNavItems, useToyboxNavItems } from "./pickers";
import type { NavDropdownItem } from "@/lib/site-nav-items";

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
}: {
  editor: Editor;
  keys: readonly string[];
  prefix: "spire" | "character";
  labels: Record<string, string>;
}) {
  const active = editor.getAttributes("pagestormColor").colorKey as string | undefined;
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
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale];
  const editorCopy = copy.pagestorm;
  const compendiumItems = useCompendiumNavItems();
  const toyboxItems = useToyboxNavItems();
  const textAlign = editor.isActive({ textAlign: "center" })
    ? "center"
    : editor.isActive({ textAlign: "right" })
      ? "right"
      : "left";

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <IconTipButton
          label={editorCopy.bold}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.italic}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.heading2}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.heading3}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.bulletList}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.blockquote}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={editorCopy.divider}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <AlignButtons
          value={textAlign}
          onChange={(align) => editor.chain().focus().setTextAlign(align).run()}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ColorSwatches
          editor={editor}
          keys={PAGESTORM_SPIRE_COLOR_KEYS}
          prefix="spire"
          labels={editorCopy.spireColors}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ColorSwatches
          editor={editor}
          keys={PAGESTORM_CHARACTER_COLOR_KEYS}
          prefix="character"
          labels={editorCopy.characterColors}
        />
        <IconTipButton
          label={`${editorCopy.sine} · ${editorCopy.sineHint}`}
          active={editor.isActive("sine")}
          onClick={() => editor.chain().focus().toggleMark("sine").run()}
        >
          <Waves className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
        <IconTipButton
          label={`${editorCopy.jitter} · ${editorCopy.jitterHint}`}
          active={editor.isActive("jitter")}
          onClick={() => editor.chain().focus().toggleMark("jitter").run()}
        >
          <Zap className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
      </div>
      <hr className="border-border" />
      <div className="flex flex-wrap items-center gap-2">
        <PickerNavDropdown
          icon="/images/sts2/icons/app_icon.png"
          alt={copy.games.sts2Codex}
          items={compendiumItems}
          onPick={onCompendium}
        />
        <PickerNavDropdown
          icon="/images/sts2/relics/toy_box.webp"
          alt={editorCopy.toyboxSection}
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

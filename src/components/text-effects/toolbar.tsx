"use client";

import { isTextSelection } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Waves, Zap } from "lucide-react";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import type { PagestormColorKey } from "@/components/pagestorm/color-marks";
import { tierColorBar } from "@/lib/decisions-decisions";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

const TRANSFIGURE_COLOR_KEYS = [
  "gold",
  "green",
  "aqua",
  "orange",
  "red",
  "blue",
  "pink",
  "purple",
] as const;

function hasTextSelection(editor: Editor): boolean {
  const { selection } = editor.state;
  return isTextSelection(selection) && !selection.empty;
}

function applyColor(editor: Editor, colorKey: PagestormColorKey) {
  if (!hasTextSelection(editor)) return;
  const current = editor.getAttributes("pagestormColor").colorKey;
  const chain = editor.chain().focus();
  if (current === colorKey) {
    chain.unsetMark("pagestormColor").run();
    return;
  }
  chain.setMark("pagestormColor", { colorKey }).run();
}

function toggleEffect(editor: Editor, name: "sine" | "jitter") {
  if (!hasTextSelection(editor)) return;
  editor.chain().focus().toggleMark(name).run();
}

function TextEffectToolbarMenu({
  editor,
  serviceLocale,
}: {
  editor: Editor;
  serviceLocale: ServiceLocale;
}) {
  const copy = serviceMessages[serviceLocale].pagestorm;
  const chrome = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      colorKey: current.getAttributes("pagestormColor").colorKey as string | undefined,
      sine: current.isActive("sine"),
      jitter: current.isActive("jitter"),
    }),
  });

  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      shouldShow={({ editor: menuEditor }) => hasTextSelection(menuEditor)}
      options={{ placement: "top", offset: 8 }}
      className="z-[80]"
      data-text-effect-toolbar
    >
      <div
        className="flex items-center gap-1 rounded-md border border-primary/30 bg-[#12121a]/95 px-1 py-0.5 shadow-[0_8px_22px_rgba(0,0,0,0.55)]"
        onMouseDown={(event) => event.preventDefault()}
      >
        {TRANSFIGURE_COLOR_KEYS.map((key) => {
          const nextKey = `spire-${key}` as PagestormColorKey;
          const label = copy.spireColors[key];
          return (
            <GameUiHoverTip key={nextKey} label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
              <button
                type="button"
                aria-label={label}
                aria-pressed={chrome.colorKey === nextKey}
                className={`h-3.5 w-3.5 rounded-sm border ${
                  chrome.colorKey === nextKey ? "ring-2 ring-primary" : "border-black/50"
                }`}
                style={{ background: tierColorBar(key) }}
                onClick={() => applyColor(editor, nextKey)}
              />
            </GameUiHoverTip>
          );
        })}
        <span className="mx-0.5 h-3.5 w-px bg-white/15" aria-hidden />
        <GameUiHoverTip
          label={`${copy.sine} · ${copy.sineHint}`}
          delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
        >
          <button
            type="button"
            aria-label={copy.sine}
            aria-pressed={chrome.sine}
            className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
              chrome.sine ? "border-primary bg-primary/20 text-primary" : "border-white/15 text-zinc-300"
            }`}
            onClick={() => toggleEffect(editor, "sine")}
          >
            <Waves className="h-3 w-3" aria-hidden />
          </button>
        </GameUiHoverTip>
        <GameUiHoverTip
          label={`${copy.jitter} · ${copy.jitterHint}`}
          delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
        >
          <button
            type="button"
            aria-label={copy.jitter}
            aria-pressed={chrome.jitter}
            className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
              chrome.jitter ? "border-primary bg-primary/20 text-primary" : "border-white/15 text-zinc-300"
            }`}
            onClick={() => toggleEffect(editor, "jitter")}
          >
            <Zap className="h-3 w-3" aria-hidden />
          </button>
        </GameUiHoverTip>
      </div>
    </BubbleMenu>
  );
}

export function TextEffectToolbar({
  editor,
  serviceLocale,
}: {
  editor: Editor | null;
  serviceLocale: ServiceLocale;
}) {
  if (!editor) return null;
  return <TextEffectToolbarMenu editor={editor} serviceLocale={serviceLocale} />;
}

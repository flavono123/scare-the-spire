"use client";

import type { Editor } from "@tiptap/react";
import { Waves, Zap } from "lucide-react";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import {
  PAGESTORM_SPIRE_COLOR_KEYS,
  type PagestormColorKey,
} from "@/components/pagestorm/color-marks";
import { tierColorBar } from "@/lib/decisions-decisions";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

const TRANSFIGURE_COLOR_KEYS = PAGESTORM_SPIRE_COLOR_KEYS.filter(
  (key) => key !== "silver" && key !== "bronze",
);

function applyColor(editor: Editor, colorKey: PagestormColorKey) {
  const current = editor.getAttributes("pagestormColor").colorKey;
  if (current === colorKey) {
    editor.chain().focus().unsetMark("pagestormColor").run();
    return;
  }
  editor.chain().focus().setMark("pagestormColor", { colorKey }).run();
}

export function TextEffectToolbar({
  editor,
  serviceLocale,
}: {
  editor: Editor | null;
  serviceLocale: ServiceLocale;
}) {
  const copy = serviceMessages[serviceLocale].pagestorm;
  const colorKey = editor?.getAttributes("pagestormColor").colorKey as string | undefined;
  const sine = editor?.isActive("sine") ?? false;
  const jitter = editor?.isActive("jitter") ?? false;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5"
      data-text-effect-toolbar
    >
      {TRANSFIGURE_COLOR_KEYS.map((key) => {
        const nextKey = `spire-${key}` as PagestormColorKey;
        const label = copy.spireColors[key];
        return (
          <GameUiHoverTip key={nextKey} label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={colorKey === nextKey}
              disabled={!editor}
              className={`h-5 w-5 rounded-sm border disabled:opacity-40 ${
                colorKey === nextKey ? "ring-2 ring-foreground" : "border-black/40"
              }`}
              style={{ background: tierColorBar(key) }}
              onClick={() => editor && applyColor(editor, nextKey)}
            />
          </GameUiHoverTip>
        );
      })}
      <GameUiHoverTip
        label={`${copy.sine} · ${copy.sineHint}`}
        delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
      >
        <button
          type="button"
          aria-label={copy.sine}
          aria-pressed={sine}
          disabled={!editor}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-40 ${
            sine ? "border-primary bg-primary/20 text-primary" : "border-white/15 text-zinc-300"
          }`}
          onClick={() => editor?.chain().focus().toggleMark("sine").run()}
        >
          <Waves className="h-3.5 w-3.5" aria-hidden />
        </button>
      </GameUiHoverTip>
      <GameUiHoverTip
        label={`${copy.jitter} · ${copy.jitterHint}`}
        delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
      >
        <button
          type="button"
          aria-label={copy.jitter}
          aria-pressed={jitter}
          disabled={!editor}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-40 ${
            jitter ? "border-primary bg-primary/20 text-primary" : "border-white/15 text-zinc-300"
          }`}
          onClick={() => editor?.chain().focus().toggleMark("jitter").run()}
        >
          <Zap className="h-3.5 w-3.5" aria-hidden />
        </button>
      </GameUiHoverTip>
    </div>
  );
}

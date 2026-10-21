"use client";

import { ReactRenderer } from "@tiptap/react";
import type { PluginKey } from "@tiptap/pm/state";
import {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import type { ComponentType, RefAttributes } from "react";
import type { SuggestionListRef } from "./suggestion-list";

/** Above service modals and sheets, below the hover tip layer. */
export const EDITOR_SUGGESTION_Z_INDEX = 10040;

const VIEWPORT_MARGIN = 8;
const CARET_GAP = 6;
/** Prefer below the caret while at least this much room is left there. */
const MIN_BELOW_HEIGHT = 160;

type ListProps = { items: readonly unknown[] };
type ItemOf<Props> = Props extends { items: readonly (infer Item)[] } ? Item : never;

function caretRect(props: SuggestionProps): DOMRect | null {
  const rect = props.clientRect?.() ?? null;
  if (rect) return rect;
  try {
    const coords = props.editor.view.coordsAtPos(props.editor.state.selection.from);
    return new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
  } catch {
    return null;
  }
}

/**
 * Place the popup against the caret inside the *visual* viewport. On phones
 * the keyboard shrinks the visual viewport but not the layout viewport, so
 * `window.innerHeight` would put the menu under the keyboard.
 */
function placePopup(popup: HTMLElement, props: SuggestionProps) {
  const rect = caretRect(props);
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewLeft = viewport?.offsetLeft ?? 0;
  const viewHeight = viewport?.height ?? window.innerHeight;
  const viewWidth = viewport?.width ?? window.innerWidth;
  const viewBottom = viewTop + viewHeight;

  if (!rect || rect.bottom < viewTop || rect.top > viewBottom) {
    popup.style.visibility = "hidden";
    return;
  }
  popup.style.visibility = "";

  const below = viewBottom - rect.bottom - CARET_GAP - VIEWPORT_MARGIN;
  const above = rect.top - viewTop - CARET_GAP - VIEWPORT_MARGIN;
  const placeBelow = below >= MIN_BELOW_HEIGHT || below >= above;
  const room = Math.max(72, Math.floor(placeBelow ? below : above));
  popup.style.setProperty("--editor-suggestion-max-height", `${room}px`);

  const height = Math.min(popup.offsetHeight, room);
  const width = popup.offsetWidth;
  const maxLeft = viewLeft + viewWidth - width - VIEWPORT_MARGIN;
  const left = Math.max(viewLeft + VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));
  const top = placeBelow ? rect.bottom + CARET_GAP : rect.top - CARET_GAP - height;
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.dataset.placement = placeBelow ? "below" : "above";
}

/**
 * The `render` half of a TipTap suggestion: one floating list per editor,
 * shared by every brace/slash/hash menu so they behave alike.
 *
 * - Taps on the list keep focus in the editor, so a phone keyboard stays up
 *   and the page does not jump.
 * - The list follows the caret through scrolling and keyboard resizes.
 * - A press outside the editor and the list closes the menu.
 */
export function suggestionPopupRender<Props extends ListProps>({
  component,
  pluginKey,
  name,
  extraProps,
  toCommandProps = (item) => item as unknown as Record<string, unknown>,
  commitKeys = [],
  onOpenChange,
}: {
  component: ComponentType<Props & RefAttributes<SuggestionListRef>>;
  pluginKey: PluginKey;
  /** `data-editor-suggestion` value, for tests and styling hooks. */
  name: string;
  extraProps?: () => Omit<Props, "items" | "command">;
  toCommandProps?: (item: ItemOf<Props>) => Record<string, unknown>;
  /** Extra keys that pick the highlighted row, e.g. `}` for brace menus. */
  commitKeys?: string[];
  onOpenChange?: (open: boolean) => void;
}): NonNullable<SuggestionOptions["render"]> {
  return () => {
    let renderer: ReactRenderer<SuggestionListRef, Props> | null = null;
    let popup: HTMLDivElement | null = null;
    let latest: SuggestionProps | null = null;
    let cleanup: Array<() => void> = [];

    const listProps = (props: SuggestionProps) => ({
      ...(extraProps?.() ?? {}),
      items: props.items,
      command: (item: ItemOf<Props>) => props.command(toCommandProps(item)),
    }) as unknown as Props;

    const reposition = () => {
      if (popup && latest) placePopup(popup, latest);
    };

    const dismiss = () => {
      for (const stop of cleanup) stop();
      cleanup = [];
      popup?.remove();
      renderer?.destroy();
      popup = null;
      renderer = null;
      latest = null;
      onOpenChange?.(false);
    };

    const listen = (
      target: EventTarget,
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, listener, options);
      cleanup.push(() => target.removeEventListener(type, listener, options));
    };

    return {
      onStart: (props) => {
        dismiss();
        latest = props;
        onOpenChange?.(true);
        renderer = new ReactRenderer(component, {
          props: listProps(props),
          editor: props.editor,
        });
        popup = document.createElement("div");
        popup.dataset.editorSuggestion = name;
        popup.style.position = "fixed";
        popup.style.zIndex = String(EDITOR_SUGGESTION_Z_INDEX);
        popup.style.maxWidth = `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`;
        popup.appendChild(renderer.element);
        document.body.appendChild(popup);

        // mousedown is what moves focus; touch scrolling inside the list
        // does not depend on it, so the list still scrolls.
        listen(popup, "mousedown", (event) => event.preventDefault());
        const view = props.editor.view;
        listen(document, "pointerdown", (event) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (popup?.contains(target) || view.dom.contains(target)) return;
          exitSuggestion(view, pluginKey);
        }, { capture: true });
        listen(window, "scroll", reposition, { capture: true, passive: true });
        listen(window, "resize", reposition, { passive: true });
        if (window.visualViewport) {
          listen(window.visualViewport, "resize", reposition, { passive: true });
          listen(window.visualViewport, "scroll", reposition, { passive: true });
        }
        // The list mounts on the next frame; measure it once it has a size.
        requestAnimationFrame(reposition);
        reposition();
      },
      onUpdate: (props) => {
        latest = props;
        renderer?.updateProps(listProps(props));
        requestAnimationFrame(reposition);
        reposition();
      },
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        // The plugin exits on Escape itself.
        if (event.key === "Escape") return true;
        if (commitKeys.includes(event.key)) {
          return renderer?.ref?.onKeyDown({
            event: new KeyboardEvent("keydown", { key: "Enter" }),
          }) ?? false;
        }
        return renderer?.ref?.onKeyDown({ event }) ?? false;
      },
      onExit: dismiss,
    };
  };
}

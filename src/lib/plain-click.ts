import type { MouseEvent } from "react";

export function isPlainLeftClick(
  event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button">,
): boolean {
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
}

/**
 * Back link of a detail view: in a modal a plain click closes it, and a
 * modified click stays a link so it can open a new tab or window.
 */
export function closeOnPlainClick(event: MouseEvent, onClose: (() => void) | undefined): void {
  if (!onClose || !isPlainLeftClick(event)) return;
  event.preventDefault();
  onClose();
}

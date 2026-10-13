export const IMAGE_CAPTURE_GUTTER_PX = 28;

export interface CaptureRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CaptureInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Extra padding so a capture includes paint that sits on or outside the
 * element's border box, plus an even gutter. The cost orb is flush with the
 * card tile's top edge, and html-to-image clips that edge.
 */
export function imageCaptureInsets(
  root: CaptureRect,
  descendants: readonly CaptureRect[],
  gutter = IMAGE_CAPTURE_GUTTER_PX,
): CaptureInsets {
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  for (const rect of descendants) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) continue;
    left = Math.max(left, root.left - rect.left);
    top = Math.max(top, root.top - rect.top);
    right = Math.max(right, rect.right - root.right);
    bottom = Math.max(bottom, rect.bottom - root.bottom);
  }
  return {
    top: Math.ceil(Math.max(0, top)) + gutter,
    right: Math.ceil(Math.max(0, right)) + gutter,
    bottom: Math.ceil(Math.max(0, bottom)) + gutter,
    left: Math.ceil(Math.max(0, left)) + gutter,
  };
}

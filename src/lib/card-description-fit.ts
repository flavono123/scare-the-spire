export const CARD_DESCRIPTION_SAFE_HEIGHT_RATIO = 0.9;
export const DEFAULT_MINIMUM_DESCRIPTION_FONT_SCALE = 0.55;

export function fitCardDescriptionText({
  viewport,
  content,
  baseFontCqi,
  minimumFontScale = DEFAULT_MINIMUM_DESCRIPTION_FONT_SCALE,
  availableHeightRatio = CARD_DESCRIPTION_SAFE_HEIGHT_RATIO,
  scaleStep,
}: {
  viewport: HTMLElement;
  content: HTMLElement;
  baseFontCqi: number;
  minimumFontScale?: number;
  availableHeightRatio?: number;
  /** Shrink in whole steps of this scale (e.g. 1/21 for a 21px game font). */
  scaleStep?: number;
}): { fits: boolean; fontScale: number } {
  const minimumScale = Math.min(1, Math.max(0.35, minimumFontScale));
  const applyScale = (scale: number) => {
    content.style.fontSize = `${baseFontCqi * scale}cqi`;
  };
  const overflows = (heightRatio: number) => {
    const viewportRect = viewport.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    // clientHeight rounds to whole px, which let a 1px overflow pass at small sizes.
    const availableHeight = viewportRect.height * heightRatio;
    const nestedFitContents = content.querySelectorAll<HTMLElement>(
      "[data-card-description-fit-content]",
    );

    return (
      content.scrollHeight > availableHeight + 1
      || content.scrollWidth > viewport.clientWidth + 1
      || contentRect.height > availableHeight + 0.5
      || contentRect.width > viewportRect.width + 0.5
      || Array.from(nestedFitContents).some((element) => (
        element.scrollHeight > element.clientHeight + 1
        || element.scrollWidth > element.clientWidth + 1
      ))
    );
  };
  const largestScaleThatFits = (floor: number, ceiling: number, heightRatio: number) => {
    if (scaleStep) {
      // Integer steps, like MegaRichTextLabel's binary search over font sizes.
      let low = Math.ceil(floor / scaleStep - 1e-6);
      let high = Math.floor(ceiling / scaleStep + 1e-6);
      let best = low;
      while (low <= high) {
        const mid = (low + high) >> 1;
        applyScale(mid * scaleStep);
        if (overflows(heightRatio)) high = mid - 1;
        else {
          best = mid;
          low = mid + 1;
        }
      }
      return Math.max(floor, best * scaleStep);
    }
    let lower = floor;
    let upper = ceiling;
    for (let index = 0; index < 8; index += 1) {
      const candidate = (lower + upper) / 2;
      applyScale(candidate);
      if (overflows(heightRatio)) upper = candidate;
      else lower = candidate;
    }
    return Math.max(floor, lower - 0.002);
  };

  applyScale(1);
  let fontScale = 1;
  let fits = !overflows(availableHeightRatio);

  if (!fits) {
    applyScale(minimumScale);
    fits = !overflows(availableHeightRatio);
    fontScale = minimumScale;

    if (fits) {
      fontScale = largestScaleThatFits(minimumScale, 1, availableHeightRatio);
      applyScale(fontScale);
    } else {
      // The usual floor still sticks out of a centered box, so the first and
      // last lines are both cut. Keep shrinking inside the full description well.
      const floor = 0.28;
      applyScale(floor);
      fits = !overflows(1);
      fontScale = floor;
      if (fits) {
        fontScale = largestScaleThatFits(floor, minimumScale, 1);
        applyScale(fontScale);
        fits = !overflows(1);
      }
    }
  }

  viewport.dataset.cardDescriptionFits = String(fits);
  content.dataset.cardDescriptionFontScale = fontScale.toFixed(3);
  return { fits, fontScale };
}

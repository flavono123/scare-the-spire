export const CARD_DESCRIPTION_SAFE_HEIGHT_RATIO = 0.9;
export const DEFAULT_MINIMUM_DESCRIPTION_FONT_SCALE = 0.55;

export function fitCardDescriptionText({
  viewport,
  content,
  baseFontCqi,
  minimumFontScale = DEFAULT_MINIMUM_DESCRIPTION_FONT_SCALE,
  availableHeightRatio = CARD_DESCRIPTION_SAFE_HEIGHT_RATIO,
}: {
  viewport: HTMLElement;
  content: HTMLElement;
  baseFontCqi: number;
  minimumFontScale?: number;
  availableHeightRatio?: number;
}): { fits: boolean; fontScale: number } {
  const minimumScale = Math.min(1, Math.max(0.35, minimumFontScale));
  const applyScale = (scale: number) => {
    content.style.fontSize = `${baseFontCqi * scale}cqi`;
  };
  const overflows = () => {
    const viewportRect = viewport.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const availableHeight = viewport.clientHeight * availableHeightRatio;
    const nestedFitContents = content.querySelectorAll<HTMLElement>(
      "[data-card-description-fit-content]",
    );

    return (
      content.scrollHeight > availableHeight + 1
      || content.scrollWidth > viewport.clientWidth + 1
      || contentRect.height > availableHeight + 1
      || contentRect.width > viewportRect.width + 1
      || Array.from(nestedFitContents).some((element) => (
        element.scrollHeight > element.clientHeight + 1
        || element.scrollWidth > element.clientWidth + 1
      ))
    );
  };

  applyScale(1);
  let fontScale = 1;
  let fits = !overflows();

  if (!fits) {
    applyScale(minimumScale);
    fits = !overflows();
    fontScale = minimumScale;

    if (fits) {
      let lower = minimumScale;
      let upper = 1;
      for (let index = 0; index < 8; index += 1) {
        const candidate = (lower + upper) / 2;
        applyScale(candidate);
        if (overflows()) upper = candidate;
        else lower = candidate;
      }
      fontScale = Math.max(minimumScale, lower - 0.002);
      applyScale(fontScale);
    }
  }

  viewport.dataset.cardDescriptionFits = String(fits);
  content.dataset.cardDescriptionFontScale = fontScale.toFixed(3);
  return { fits, fontScale };
}

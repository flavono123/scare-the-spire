import { fitCardDescriptionText } from "@/lib/card-description-fit";
import { DESCRIPTION_FIT, FONT_CQI } from "@/lib/sts2-card-style";

(() => {
  const TRIGGER_SELECTOR = "[data-static-card-trigger]";
  const TEMPLATE_SELECTOR = "[data-static-card-preview-template]";
  const PREVIEW_SELECTOR = "[data-static-card-preview]";
  const MARGIN = 12;

  const previews = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLTemplateElement>(TEMPLATE_SELECTOR).forEach((template) => {
    const key = template.getAttribute("data-static-card-preview-template");
    const preview = template.content.querySelector<HTMLElement>(PREVIEW_SELECTOR);
    template.remove();
    if (!preview) return;
    if (!key || previews.has(key)) return;
    preview.hidden = true;
    preview.style.position = "fixed";
    preview.style.zIndex = "120";
    preview.style.pointerEvents = "none";
    preview.style.maxWidth = `calc(100vw - ${MARGIN * 2}px)`;
    document.body.appendChild(preview);
    previews.set(key, preview);
  });

  let activePreview: HTMLElement | null = null;

  function hidePreview() {
    if (activePreview) activePreview.hidden = true;
    activePreview = null;
  }

  function fitPreview(preview: HTMLElement) {
    preview.querySelectorAll<HTMLElement>("[data-card-description-viewport]").forEach((viewport) => {
      const content = viewport.querySelector<HTMLElement>("[data-card-description-content]");
      if (!content) return;
      fitCardDescriptionText({
        viewport,
        content,
        baseFontCqi: FONT_CQI.description,
        ...DESCRIPTION_FIT,
      });
    });
  }

  function showPreview(trigger: Element) {
    const key = trigger.getAttribute("data-static-card-trigger");
    const preview = key ? previews.get(key) : undefined;
    if (!preview) return;

    hidePreview();
    preview.hidden = false;
    preview.style.visibility = "hidden";
    preview.style.left = "0";
    preview.style.top = "0";
    fitPreview(preview);

    const triggerRect = trigger.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const left = Math.max(
      Math.min(
        triggerRect.left + triggerRect.width / 2 - previewRect.width / 2,
        window.innerWidth - previewRect.width - MARGIN,
      ),
      MARGIN,
    );
    const top = triggerRect.top >= previewRect.height + MARGIN
      ? triggerRect.top - previewRect.height - 8
      : triggerRect.bottom + 8;

    preview.style.left = `${left}px`;
    preview.style.top = `${Math.min(top, window.innerHeight - previewRect.height - MARGIN)}px`;
    preview.style.visibility = "";
    activePreview = preview;
  }

  const closestTrigger = (target: EventTarget | null) =>
    target instanceof Element ? target.closest(TRIGGER_SELECTOR) : null;
  const movedOutside = (trigger: Element, relatedTarget: EventTarget | null) =>
    !(relatedTarget instanceof Node) || !trigger.contains(relatedTarget);

  // Touch screens get two taps: the first opens the preview, a second tap on the
  // same keyword follows its link, and a tap elsewhere closes it. Without this a
  // tap followed the link at once (iOS only paused on CSS-hover previews).
  const touchScreen = window.matchMedia("(hover: none)");
  const CSS_TIP_OPEN = "is-tap-open";
  let armedTrigger: Element | null = null;

  function cssTipTrigger(target: Element): Element | null {
    const group = target.closest(".group");
    return group?.querySelector(":scope > .entity-hover-tip") ? group : null;
  }

  function disarm() {
    armedTrigger?.classList.remove(CSS_TIP_OPEN);
    armedTrigger = null;
    hidePreview();
  }

  document.addEventListener("click", (event) => {
    if (!touchScreen.matches || !(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    const trigger = closestTrigger(event.target) ?? cssTipTrigger(event.target);
    if (!link || !trigger || !trigger.contains(link)) {
      disarm();
      return;
    }
    if (armedTrigger === trigger) {
      disarm();
      return;
    }
    event.preventDefault();
    disarm();
    armedTrigger = trigger;
    if (trigger.matches(TRIGGER_SELECTOR)) showPreview(trigger);
    else trigger.classList.add(CSS_TIP_OPEN);
  }, true);

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const trigger = closestTrigger(event.target);
    if (trigger && movedOutside(trigger, event.relatedTarget)) showPreview(trigger);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.pointerType === "touch") return;
    const trigger = closestTrigger(event.target);
    if (trigger && movedOutside(trigger, event.relatedTarget)) hidePreview();
  });
  document.addEventListener("focusin", (event) => {
    const trigger = closestTrigger(event.target);
    if (trigger) showPreview(trigger);
  });
  document.addEventListener("focusout", (event) => {
    const trigger = closestTrigger(event.target);
    if (trigger && movedOutside(trigger, event.relatedTarget)) hidePreview();
  });
  window.addEventListener("resize", disarm);
  window.addEventListener("scroll", disarm, { passive: true });
})();

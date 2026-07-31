(() => {
  const TRIGGER_SELECTOR = "[data-static-card-trigger]";
  const PREVIEW_SELECTOR = "[data-static-card-preview]";
  const MARGIN = 12;

  const previews = new Map();
  document.querySelectorAll(PREVIEW_SELECTOR).forEach((preview) => {
    const key = preview.getAttribute("data-static-card-preview");
    if (!key || previews.has(key)) return;
    preview.hidden = true;
    preview.style.position = "fixed";
    preview.style.zIndex = "120";
    preview.style.pointerEvents = "none";
    document.body.appendChild(preview);
    previews.set(key, preview);
  });

  let activePreview = null;

  function hidePreview() {
    if (activePreview) activePreview.hidden = true;
    activePreview = null;
  }

  function showPreview(trigger) {
    const preview = previews.get(trigger.getAttribute("data-static-card-trigger"));
    if (!preview) return;

    hidePreview();
    preview.hidden = false;
    preview.style.visibility = "hidden";
    preview.style.left = "0";
    preview.style.top = "0";

    const triggerRect = trigger.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const left = Math.min(
      Math.max(triggerRect.left + triggerRect.width / 2 - previewRect.width / 2, MARGIN),
      window.innerWidth - previewRect.width - MARGIN,
    );
    const top = triggerRect.top >= previewRect.height + MARGIN
      ? triggerRect.top - previewRect.height - 8
      : triggerRect.bottom + 8;

    preview.style.left = `${left}px`;
    preview.style.top = `${Math.min(top, window.innerHeight - previewRect.height - MARGIN)}px`;
    preview.style.visibility = "";
    activePreview = preview;
  }

  document.addEventListener("pointerover", (event) => {
    const trigger = event.target.closest?.(TRIGGER_SELECTOR);
    if (trigger && !trigger.contains(event.relatedTarget)) showPreview(trigger);
  });
  document.addEventListener("pointerout", (event) => {
    const trigger = event.target.closest?.(TRIGGER_SELECTOR);
    if (trigger && !trigger.contains(event.relatedTarget)) hidePreview();
  });
  document.addEventListener("focusin", (event) => {
    const trigger = event.target.closest?.(TRIGGER_SELECTOR);
    if (trigger) showPreview(trigger);
  });
  document.addEventListener("focusout", (event) => {
    const trigger = event.target.closest?.(TRIGGER_SELECTOR);
    if (trigger && !trigger.contains(event.relatedTarget)) hidePreview();
  });
  window.addEventListener("resize", hidePreview);
  window.addEventListener("scroll", hidePreview, { passive: true });
})();

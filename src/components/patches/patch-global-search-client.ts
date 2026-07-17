import {
  globalSearchItemScore,
  globalSearchTypeOrder,
  globalSearchTypeStyles,
  type GlobalSearchIndexItem,
  type GlobalSearchType,
} from "@/lib/global-search";
import {
  isGameLocale,
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

type SearchIndexPayload = {
  items?: GlobalSearchIndexItem[];
};

type LoadState = "idle" | "loading" | "ready" | "error";

const html = document.documentElement;
const serviceLocale: ServiceLocale = html.dataset.serviceLocale === "en" ? "en" : "ko";
const rawGameLocale = html.dataset.gameLocale ?? "kor";
const gameLocale: GameLocale = isGameLocale(rawGameLocale) ? rawGameLocale : "kor";

const trigger = document.querySelector<HTMLButtonElement>("[data-patch-global-search-trigger]");
const overlay = document.querySelector<HTMLElement>("[data-patch-global-search-overlay]");
const panel = document.querySelector<HTMLElement>("[data-patch-global-search-panel]");
const input = document.querySelector<HTMLInputElement>("[data-patch-global-search-input]");
const resultsRoot = document.querySelector<HTMLElement>("[data-patch-global-search-results]");
const fallbackLabels = Object.fromEntries(
  globalSearchTypeOrder.map((type) => [type, type]),
) as Record<GlobalSearchType, string>;
const labels = (() => {
  try {
    return JSON.parse(overlay?.dataset.typeLabels ?? "") as Record<GlobalSearchType, string>;
  } catch {
    return fallbackLabels;
  }
})();
const copy = {
  empty: overlay?.dataset.emptyMessage ?? "",
  loading: overlay?.dataset.loadingMessage ?? "",
  noResults: overlay?.dataset.noResultsMessage ?? "",
};

let items: GlobalSearchIndexItem[] = [];
let loadState: LoadState = "idle";
let loadPromise: Promise<void> | null = null;

function clearResults() {
  resultsRoot?.replaceChildren();
}

function renderMessage(message: string) {
  if (!resultsRoot) return;
  const element = document.createElement("div");
  element.className = "px-3 py-8 text-center text-sm text-muted-foreground";
  element.textContent = message;
  resultsRoot.replaceChildren(element);
}

function localizedResultHref(item: GlobalSearchIndexItem): string {
  return localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale);
}

function rankedResults(query: string): GlobalSearchIndexItem[] {
  return items
    .map((item) => ({ item, score: globalSearchItemScore(item, query, labels) }))
    .filter((entry): entry is { item: GlobalSearchIndexItem; score: number } => entry.score !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return globalSearchTypeOrder.indexOf(a.item.type) - globalSearchTypeOrder.indexOf(b.item.type);
    })
    .map((entry) => entry.item)
    .slice(0, 40);
}

function groupResults(searchResults: GlobalSearchIndexItem[]) {
  const byType = new Map<GlobalSearchType, GlobalSearchIndexItem[]>();
  for (const item of searchResults) {
    const group = byType.get(item.type);
    if (group) group.push(item);
    else byType.set(item.type, [item]);
  }

  return globalSearchTypeOrder
    .map((type) => ({ type, items: byType.get(type) ?? [] }))
    .filter((group) => group.items.length > 0);
}

function createResultRow(item: GlobalSearchIndexItem): HTMLAnchorElement {
  const style = globalSearchTypeStyles[item.type];
  const link = document.createElement("a");
  link.href = localizedResultHref(item);
  link.className = "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-white/[0.07]";

  const imageFrame = document.createElement("span");
  imageFrame.className = `flex h-9 w-9 shrink-0 items-center justify-center rounded border ${style.bg} ${style.border}`;
  const image = document.createElement("img");
  image.src = item.imageUrl ?? style.icon;
  image.alt = "";
  image.width = 32;
  image.height = 32;
  image.className = "h-8 w-8 object-contain";
  image.addEventListener("error", () => {
    if (image.getAttribute("src") !== style.icon) image.src = style.icon;
  });
  imageFrame.append(image);

  const text = document.createElement("span");
  text.className = "min-w-0 flex-1";
  const title = document.createElement("span");
  title.className = "block truncate font-semibold text-foreground";
  title.textContent = serviceLocale === "ko" ? item.title : item.titleEn;
  const type = document.createElement("span");
  type.className = `block truncate text-xs ${style.color}`;
  type.textContent = labels[item.type];
  text.append(title, type);

  link.append(imageFrame, text);
  return link;
}

function renderSearchResults() {
  if (!resultsRoot || !input) return;
  const query = input.value.trim();

  if (!query) {
    renderMessage(copy.empty);
    return;
  }
  if (loadState === "idle" || loadState === "loading") {
    renderMessage(copy.loading);
    return;
  }
  if (loadState === "error") {
    renderMessage(copy.noResults);
    return;
  }

  const results = rankedResults(query);
  if (results.length === 0) {
    renderMessage(copy.noResults);
    return;
  }

  clearResults();
  for (const group of groupResults(results)) {
    const style = globalSearchTypeStyles[group.type];
    const section = document.createElement("section");
    section.className = "py-1";

    const header = document.createElement("div");
    header.className = "flex items-center gap-2 px-2.5 py-1";
    const label = document.createElement("span");
    label.className = `inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-bold ${style.bg} ${style.border} ${style.color}`;
    label.textContent = labels[group.type];
    const count = document.createElement("span");
    count.className = "text-[10px] tabular-nums text-muted-foreground";
    count.textContent = String(group.items.length);
    header.append(label, count);
    section.append(header);

    for (const item of group.items.slice(0, 8)) {
      section.append(createResultRow(item));
    }
    resultsRoot.append(section);
  }
}

function loadIndex(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadState = "loading";
  loadPromise = fetch("/generated/search-index.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
      return response.json() as Promise<SearchIndexPayload>;
    })
    .then((payload) => {
      items = payload.items ?? [];
      loadState = "ready";
    })
    .catch(() => {
      loadState = "error";
    })
    .finally(renderSearchResults);
  return loadPromise;
}

function openSearch() {
  if (!overlay || !input || !trigger) return;
  overlay.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  void loadIndex();
  renderSearchResults();
  window.setTimeout(() => input.focus(), 0);
}

function closeSearch() {
  if (!overlay || !trigger) return;
  overlay.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  trigger.focus();
}

trigger?.addEventListener("click", openSearch);
input?.addEventListener("input", renderSearchResults);
overlay?.addEventListener("pointerdown", (event) => {
  if (event.target instanceof Node && panel?.contains(event.target)) return;
  closeSearch();
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
    return;
  }
  if (event.key === "Escape" && overlay && !overlay.hidden) {
    event.preventDefault();
    closeSearch();
  }
});

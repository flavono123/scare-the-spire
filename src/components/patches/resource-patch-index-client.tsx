import { hydrateRoot } from "react-dom/client";
import { ResourcePatchIndexExplorer } from "@/components/patches/resource-patch-index-explorer";
import type { ServiceLocale } from "@/lib/i18n";
import type { ResourcePatchIndexData } from "@/lib/resource-patch-index";

async function mount() {
  const root = document.getElementById("sts-resource-patch-index-root");
  if (!root) return;

  const asset = root.dataset.resourcePatchIndexAsset;
  const serviceLocale = root.dataset.serviceLocale === "en" ? "en" : "ko";
  const storyPlaceholder = root.dataset.storyPlaceholder ?? "";
  if (!asset) return;

  const response = await fetch(asset);
  if (!response.ok) throw new Error(`Resource patch index failed: ${response.status}`);
  const data = await response.json() as ResourcePatchIndexData;

  hydrateRoot(
    root,
    <ResourcePatchIndexExplorer
      data={data}
      serviceLocale={serviceLocale satisfies ServiceLocale}
      storyPlaceholder={storyPlaceholder}
    />,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void mount(), { once: true });
} else {
  void mount();
}

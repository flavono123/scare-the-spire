import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PatchNoteRenderer,
  type EntityInfo,
} from "@/components/patch-note-renderer";

function renderPatch(markdown: string, entities: EntityInfo[]): string {
  return renderToStaticMarkup(
    <PatchNoteRenderer
      markdown={markdown}
      entities={entities}
      serviceLocale="en"
      gameLocale="eng"
    />,
  );
}

const pendingCard: EntityInfo = {
  id: "FAKE_PATCH_LOCAL_CARD",
  nameEn: "Patch First Test Card",
  nameKo: "Patch First Test Card",
  imageUrl: "/_patches/test/patch-first-test-card.webp",
  href: null,
  availability: "pending-compendium",
  color: "pending",
  type: "card",
};

const pendingHtml = renderPatch("[gold:card]Patch First Test Card[/gold]", [pendingCard]);
assert.match(pendingHtml, /Compendium page in progress/);
assert.match(pendingHtml, /role="button"/);
assert.doesNotMatch(pendingHtml, /href="\/compendium\/cards\/fake_patch_local_card"/);

const availableCard: EntityInfo = {
  id: "BASH",
  nameEn: "Bash",
  nameKo: "Bash",
  imageUrl: "/images/sts2/cards/bash.webp",
  availability: "available",
  color: "red",
  type: "card",
};

const availableHtml = renderPatch("[gold:card]Bash[/gold]", [availableCard]);
assert.match(availableHtml, /href="\/en\/compendium\/cards\/bash"/);

console.log("patch pending link regression passed");

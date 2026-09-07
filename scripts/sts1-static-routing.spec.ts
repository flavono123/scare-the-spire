import assert from "node:assert/strict";

import {
  staticCompendiumAssetPath,
  staticLegacyPageAssetPath,
  sts1LegacyAliasPath,
  sts2CompendiumAliasPath,
} from "../workers/static-page-routing";

assert.equal(sts1LegacyAliasPath("/cards"), "/compendium/sts1/cards");
assert.equal(sts1LegacyAliasPath("/cards/bash"), "/compendium/sts1/cards/bash");
assert.equal(sts1LegacyAliasPath("/cards/strike-ironclad"), "/compendium/sts1/cards/strike-ironclad");
assert.equal(sts1LegacyAliasPath("/en/cards/bash"), null);

assert.equal(
  staticLegacyPageAssetPath("/cards", "html"),
  "/_cf_static_pages/compendium/sts1/cards.html",
);
assert.equal(
  staticLegacyPageAssetPath("/cards/bash", "rsc"),
  "/_cf_static_pages/compendium/sts1/cards/bash.rsc",
);

assert.equal(sts2CompendiumAliasPath("/compendium/sts2/cards"), "/compendium/cards");
assert.equal(
  sts2CompendiumAliasPath("/en/compendium/sts2/relics/anchor"),
  "/en/compendium/relics/anchor",
);

assert.equal(
  staticCompendiumAssetPath("/compendium/sts1/cards", "html"),
  "/_cf_static_pages/compendium/sts1/cards.html",
);
assert.equal(
  staticCompendiumAssetPath("/en/compendium/sts1/cards/bash", "rsc"),
  "/_cf_static_pages/en/compendium/sts1/cards/bash.rsc",
);
assert.equal(staticCompendiumAssetPath("/zh/compendium/sts1/cards/bash", "html"), null);
assert.equal(
  staticCompendiumAssetPath("/zh/compendium/sts1/cards", "html"),
  "/_cf_static_pages/zh/compendium/sts1/cards.html",
);

console.log("sts1-static-routing.spec.ts: ok");

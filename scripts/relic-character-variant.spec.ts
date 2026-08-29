import assert from "node:assert/strict";
import type { CodexRelic } from "../src/lib/codex-types";
import {
  pickRelicCharacterVariant,
  relicAwareImageUrl,
  relicPoolFromCharacterId,
  resolveRelicDisplayImage,
} from "../src/lib/relic-character-variant";

const yummyCookie = {
  id: "YUMMY_COOKIE",
  imageUrl: null,
  betaImageUrl: null,
  variantImageUrls: {
    ironclad: "/images/sts2/relics/yummy_cookie_ironclad.webp",
    silent: "/images/sts2/relics/yummy_cookie_silent.webp",
    regent: "/images/sts2/relics/yummy_cookie_regent.webp",
    necrobinder: "/images/sts2/relics/yummy_cookie_necro.webp",
    defect: "/images/sts2/relics/yummy_cookie_defect.webp",
  },
} satisfies Pick<CodexRelic, "id" | "imageUrl" | "betaImageUrl" | "variantImageUrls">;

assert.equal(relicPoolFromCharacterId("IRONCLAD"), "ironclad");
assert.equal(relicPoolFromCharacterId("NECROBINDER"), "necrobinder");
assert.equal(relicPoolFromCharacterId("unknown"), "necrobinder");

assert.equal(pickRelicCharacterVariant(yummyCookie, "silent"), "silent");
assert.equal(pickRelicCharacterVariant(yummyCookie, "ironclad"), "ironclad");
assert.equal(
  resolveRelicDisplayImage(yummyCookie, relicPoolFromCharacterId("DEFECT")),
  "/images/sts2/relics/yummy_cookie_defect.webp",
);
assert.equal(
  resolveRelicDisplayImage(yummyCookie, relicPoolFromCharacterId("NECROBINDER")),
  "/images/sts2/relics/yummy_cookie_necro.webp",
);

const burningBlood = {
  imageUrl: "/images/sts2/relics/burning_blood.webp",
  betaImageUrl: null,
  variantImageUrls: null,
} satisfies Pick<CodexRelic, "imageUrl" | "betaImageUrl" | "variantImageUrls">;

assert.equal(pickRelicCharacterVariant(burningBlood, "ironclad"), null);
assert.equal(
  resolveRelicDisplayImage(burningBlood, "silent"),
  "/images/sts2/relics/burning_blood.webp",
);
assert.equal(
  relicAwareImageUrl(
    { type: "relic", imageUrl: null, relicData: yummyCookie },
    "IRONCLAD",
  ),
  "/images/sts2/relics/yummy_cookie_ironclad.webp",
);
assert.equal(
  relicAwareImageUrl(
    { type: "relic", imageUrl: null, relicData: yummyCookie },
    "NECROBINDER",
  ),
  "/images/sts2/relics/yummy_cookie_necro.webp",
);
assert.equal(
  relicAwareImageUrl(
    { type: "potion", imageUrl: "/images/sts2/potions/potion.webp" },
    "IRONCLAD",
  ),
  "/images/sts2/potions/potion.webp",
);

import assert from "node:assert/strict";
import {
  classNameForHref,
  EXTERNAL_PROSE_LINK_CLASS,
  INTERNAL_PROSE_LINK_CLASS,
  isExternalHref,
  RESOURCE_LINK_CLASS,
} from "../src/lib/service-link-classes";

assert.equal(classNameForHref("https://youtube.com/watch?v=x"), EXTERNAL_PROSE_LINK_CLASS);
assert.equal(classNameForHref("mailto:hi@example.com"), EXTERNAL_PROSE_LINK_CLASS);
assert.equal(classNameForHref("/byrdispatch"), INTERNAL_PROSE_LINK_CLASS);
assert.equal(classNameForHref("/en/byrdispatch"), INTERNAL_PROSE_LINK_CLASS);
assert.equal(classNameForHref("/compendium/cards/strike"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/en/compendium/relics/anchor"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/patches/2026-08-01"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/cards/bash"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/this-or-that/abc"), INTERNAL_PROSE_LINK_CLASS);

assert.equal(isExternalHref("https://store.steampowered.com"), true);
assert.equal(isExternalHref("//cdn.example.com/a.png"), true);
assert.equal(isExternalHref("/pagestorm/abc"), false);
assert.equal(isExternalHref("#section"), false);

console.log("service-link-classes.spec.ts: ok");

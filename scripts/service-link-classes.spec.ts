import assert from "node:assert/strict";
import {
  classNameForHref,
  RESOURCE_LINK_CLASS,
  SERVICE_LINK_CLASS,
} from "../src/lib/service-link-classes";

assert.equal(classNameForHref("https://youtube.com/watch?v=x"), SERVICE_LINK_CLASS);
assert.equal(classNameForHref("/byrdispatch"), SERVICE_LINK_CLASS);
assert.equal(classNameForHref("/en/byrdispatch"), SERVICE_LINK_CLASS);
assert.equal(classNameForHref("/compendium/cards/strike"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/en/compendium/relics/anchor"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/patches/2026-08-01"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/cards/bash"), RESOURCE_LINK_CLASS);
assert.equal(classNameForHref("/this-or-that/abc"), SERVICE_LINK_CLASS);

console.log("service-link-classes.spec.ts: ok");

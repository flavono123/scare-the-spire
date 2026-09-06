import assert from "node:assert/strict";
import { getToyBoxNavItems } from "../src/lib/site-nav-items";

const items = getToyBoxNavItems({ serviceLocale: "ko", gameLocale: "kor" });
const hrefs = items.map((item) => item.href);

assert.equal(hrefs.includes("/this-or-that/tournament"), false);
assert.equal(hrefs.includes("/this-or-that"), true);
assert.equal(hrefs.includes("/decisions-decisions"), true);
assert.equal(hrefs.includes("/defragment"), true);

const thisOrThat = items.find((item) => item.href === "/this-or-that");
assert.ok(thisOrThat);
assert.equal(thisOrThat.isNew, false);

const decisions = items.find((item) => item.href === "/decisions-decisions");
assert.ok(decisions);
assert.equal(decisions.isNew, false);

const pagestorm = items.find((item) => item.href === "/pagestorm");
assert.ok(pagestorm);
assert.equal(pagestorm.isNew, true);

const defragment = items.find((item) => item.href === "/defragment");
assert.ok(defragment);
assert.equal(defragment.isNew, false);

console.log("toybox-nav.spec.ts: ok");

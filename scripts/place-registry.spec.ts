import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import registryPayload from "../src/data/place-registry.json";
import { PLACES, parsePlaceRegistry, placeLabel } from "../src/lib/place-registry";
import { exactRoutePlaceSegments } from "../src/lib/place-registry-routes";
import { STATIC_EXACT_SERVICE_PAGES } from "../workers/static-page-routing";

// Every image a place names ships in public/.
for (const place of PLACES) {
  for (const image of [place.token, place.art]) {
    if (!image) continue;
    assert.ok(existsSync(path.join("public", image)), `${place.id}: missing ${image}`);
  }
}

// Every href is a Next page (route groups and the locale segment ignored).
function routePaths(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === "page.tsx") out.push(prefix || "/");
      continue;
    }
    if (name === "api" || name.startsWith("[")) continue;
    const segment = name.startsWith("(") ? "" : `/${name}`;
    out.push(...routePaths(full, `${prefix}${segment}`));
  }
  return out;
}
const routes = new Set(routePaths("src/app"));
for (const place of PLACES) {
  assert.ok(routes.has(place.href), `${place.id}: no page for ${place.href}`);
}

// Labels resolve to real text in both service languages and a game-only one.
for (const place of PLACES) {
  for (const [serviceLocale, gameLocale] of [["ko", "kor"], ["en", "eng"], ["en", "jpn"]] as const) {
    const label = placeLabel(place, serviceLocale, gameLocale);
    assert.ok(label && label !== place.id, `${place.id}: no ${gameLocale} label`);
  }
}

// The Worker and the copy script read the same exact pages.
assert.deepEqual(STATIC_EXACT_SERVICE_PAGES, exactRoutePlaceSegments());

// Validation rejects the mistakes a hand edit makes.
const [first] = registryPayload.places;
assert.throws(() => parsePlaceRegistry({ places: [first, first] }), /duplicate id/);
assert.throws(() => parsePlaceRegistry({ places: [{ ...first, area: "nope" }] }), /area/);
assert.throws(() => parsePlaceRegistry({ places: [{ ...first, href: "/compendium/" }] }), /href/);
assert.throws(() => parsePlaceRegistry({ places: [{ ...first, label: { game: "nope" } }] }), /borrowed/);
assert.throws(() => parsePlaceRegistry({ places: [{ ...first, parent: "nope" }] }), /parent/);

console.log("place-registry.spec.ts: ok");

import assert from "node:assert/strict";
import { defragmentBoardPath } from "../src/lib/defragment";
import { FAVORITE_TOURNAMENT_HREF } from "../src/lib/favorite-tournament";
import {
  TOYBOX_PREVIEW_MOBILE_VIEWPORT,
  TOYBOX_PREVIEW_SURFACES,
} from "../src/lib/dev-toybox-preview";

assert.equal(TOYBOX_PREVIEW_MOBILE_VIEWPORT.width, 390);
assert.equal(TOYBOX_PREVIEW_SURFACES.length, 9);
assert.deepEqual(
  TOYBOX_PREVIEW_SURFACES.map((surface) => surface.id),
  [
    "defragment",
    "combo",
    "transfigure",
    "this_or_that",
    "favorite_tournament",
    "chemical_x",
    "decisions_decisions",
    "pagestorm",
    "history_course",
  ],
);

const defragment = TOYBOX_PREVIEW_SURFACES[0];
assert.equal(defragment.indexHref, "/defragment");
assert.equal(
  defragment.detailHref({ id: "abc", federatedService: "pagestorm" }),
  defragmentBoardPath({ id: "abc", service: "pagestorm" }),
);

const tournament = TOYBOX_PREVIEW_SURFACES.find((surface) => surface.id === "favorite_tournament");
assert.ok(tournament);
assert.equal(tournament.indexHref, FAVORITE_TOURNAMENT_HREF);
assert.equal(
  tournament.detailHref({ id: "worldcup-1" }),
  `${FAVORITE_TOURNAMENT_HREF}/worldcup-1`,
);

console.log("dev-toybox-preview.spec.ts: ok");

import assert from "node:assert/strict";
import { imageCaptureInsets, IMAGE_CAPTURE_GUTTER_PX } from "../src/lib/image-capture-frame";
import {
  elementMatchesImageCaptureSnapshot,
  imageCaptureSnapshotFromHref,
  imageCaptureSnapshotsEqual,
} from "../src/lib/image-capture-snapshot";

const root = { left: 100, top: 80, right: 400, bottom: 500 };

const inside = imageCaptureInsets(root, [
  { left: 120, top: 100, right: 380, bottom: 480 },
]);
assert.equal(inside.top, IMAGE_CAPTURE_GUTTER_PX);
assert.equal(inside.left, IMAGE_CAPTURE_GUTTER_PX);
assert.equal(inside.right, IMAGE_CAPTURE_GUTTER_PX);
assert.equal(inside.bottom, IMAGE_CAPTURE_GUTTER_PX);

const orb = imageCaptureInsets(root, [
  { left: 89.2, top: 69.4, right: 150, bottom: 140 },
]);
assert.equal(orb.left, 11 + IMAGE_CAPTURE_GUTTER_PX);
assert.equal(orb.top, 11 + IMAGE_CAPTURE_GUTTER_PX);
assert.equal(orb.right, IMAGE_CAPTURE_GUTTER_PX);
assert.equal(orb.bottom, IMAGE_CAPTURE_GUTTER_PX);

const empty = imageCaptureInsets(root, [
  { left: 0, top: 0, right: 0, bottom: 0 },
]);
assert.equal(empty.left, IMAGE_CAPTURE_GUTTER_PX);

const korean = imageCaptureSnapshotFromHref("http://localhost/compendium/cards/prepared?version=v0.99");
assert.deepEqual(korean, { gameLocale: "kor", version: "0.99" });
const english = imageCaptureSnapshotFromHref("http://localhost/en/compendium/cards/prepared?version=0.100.0");
assert.equal(english.gameLocale, "eng");
assert.equal(english.version, "0.100.0");
assert.equal(imageCaptureSnapshotsEqual(korean, { ...korean }), true);
assert.equal(imageCaptureSnapshotsEqual(korean, english), false);
assert.equal(elementMatchesImageCaptureSnapshot("kor", "0.99", korean), true);
assert.equal(elementMatchesImageCaptureSnapshot("eng", "0.99", korean), false);
assert.equal(elementMatchesImageCaptureSnapshot("kor", "0.111.0", korean), false);

console.log("image-capture-frame.spec.ts ok");

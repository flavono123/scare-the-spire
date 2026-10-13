import assert from "node:assert/strict";
import { imageCaptureInsets, IMAGE_CAPTURE_GUTTER_PX } from "../src/lib/image-capture-frame";

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

console.log("image-capture-frame.spec.ts ok");

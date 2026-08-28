import assert from "node:assert/strict";
import {
  hexToRgb255,
  luminance01,
  remapDuotoneRgba,
} from "../src/lib/duotone-pixels";

const black = hexToRgb255("#000000");
const white = hexToRgb255("#FFFFFF");
assert.deepEqual(black, { r: 0, g: 0, b: 0 });
assert.deepEqual(white, { r: 255, g: 255, b: 255 });
assert.ok(Math.abs(luminance01(255, 255, 255) - 1) < 1e-6);
assert.ok(Math.abs(luminance01(255, 0, 0) - 0.2126) < 1e-6);

const atlas = new Uint8ClampedArray([
  255, 0, 0, 255,
  0, 0, 0, 0,
]);
remapDuotoneRgba(atlas, black, white);
assert.equal(atlas[0], 54);
assert.equal(atlas[1], 54);
assert.equal(atlas[2], 54);
assert.equal(atlas[3], 255);
assert.deepEqual([...atlas.slice(4)], [0, 0, 0, 0]);

const fill = new Uint8ClampedArray([
  255, 255, 255, 180,
  0, 0, 0, 0,
]);
remapDuotoneRgba(fill, hexToRgb255("#111111"), hexToRgb255("#EEEEEE"));
assert.deepEqual([...fill], [238, 238, 238, 180, 0, 0, 0, 0]);

console.log("duotone-pixels.spec.ts: ok");

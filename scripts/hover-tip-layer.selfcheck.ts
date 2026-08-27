import assert from "node:assert/strict";
import {
  clampHoverTipPosition,
  HOVER_TIP_LAYER_Z_INDEX,
  placePortaledHoverTip,
} from "../src/lib/hover-tip-layer";

function main() {
  assert.equal(HOVER_TIP_LAYER_Z_INDEX, 10050);

  const clamped = clampHoverTipPosition({
    left: -40,
    top: 900,
    width: 280,
    height: 160,
    viewportWidth: 1280,
    viewportHeight: 800,
    margin: 8,
  });
  assert.equal(clamped.left, 8);
  assert.equal(clamped.top, 800 - 160 - 8);

  const above = placePortaledHoverTip({
    trigger: { left: 40, top: 500, right: 120, bottom: 524, width: 80, height: 24, x: 40, y: 500, toJSON() { return this; } },
    tipWidth: 240,
    tipHeight: 120,
    pin: "bottom-left",
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(above.left, 40);
  assert.equal(above.top, 500 - 120 - 8);

  const flippedBelow = placePortaledHoverTip({
    trigger: { left: 40, top: 40, right: 120, bottom: 64, width: 80, height: 24, x: 40, y: 40, toJSON() { return this; } },
    tipWidth: 240,
    tipHeight: 120,
    pin: "bottom-left",
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(flippedBelow.top, 64 + 8);

  const rightEdge = placePortaledHoverTip({
    trigger: { left: 1100, top: 200, right: 1260, bottom: 224, width: 160, height: 24, x: 1100, y: 200, toJSON() { return this; } },
    tipWidth: 320,
    tipHeight: 80,
    pin: "top-left",
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.ok(rightEdge.left + 320 <= 1280 - 8);

  console.log("hover-tip-layer.selfcheck: ok");
}

main();

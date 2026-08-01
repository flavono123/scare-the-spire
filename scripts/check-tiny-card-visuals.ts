import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TinyCardIcon } from "../src/components/history-course/card-action-icon";

function render(card: Parameters<typeof TinyCardIcon>[0]["card"]): string {
  return renderToStaticMarkup(createElement(TinyCardIcon, { card, width: 32 }));
}

const abundance = render({
  color: "event",
  rarity: "고대의 존재",
  type: "스킬",
});
assert.match(abundance, /background-color:#FFFFFF/);
assert.match(abundance, /background-color:#64FFFF/);

const eventWithSilentFrame = render({
  color: "event",
  visualColor: "silent",
  rarity: "희귀",
  type: "스킬",
});
assert.match(eventWithSilentFrame, /background-color:#A3A3A3/);
assert.match(eventWithSilentFrame, /filter:brightness\(1\.2\)/);
assert.match(eventWithSilentFrame, /background-color:#64DA36/);

const status = render({ color: "status", rarity: "상태이상", type: "상태이상" });
assert.match(status, /background-color:#FFFFFF/);
assert.match(status, /image-rendering:pixelated/);

console.log("tiny-card visuals: ok");

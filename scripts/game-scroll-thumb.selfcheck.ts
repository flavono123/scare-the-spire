import assert from "node:assert/strict";
import { gameScrollThumbTopPx } from "../src/components/game-scroll-area";

assert.equal(
  gameScrollThumbTopPx({
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 400,
    trackHeight: 300,
    trainHeight: 55,
  }),
  0,
);

assert.equal(
  gameScrollThumbTopPx({
    scrollTop: 600,
    scrollHeight: 1000,
    clientHeight: 400,
    trackHeight: 300,
    trainHeight: 55,
  }),
  245,
);

assert.equal(
  gameScrollThumbTopPx({
    scrollTop: 9999,
    scrollHeight: 500,
    clientHeight: 500,
    trackHeight: 300,
    trainHeight: 55,
  }),
  0,
);

console.log("game-scroll-thumb.selfcheck: ok");

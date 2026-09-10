import assert from "node:assert/strict";
import {
  DECISIONS_DECISIONS_CARD_WIDTH,
  DECISIONS_TOKEN_COMFORTABLE_GAP,
  DECISIONS_TOKEN_COMFORTABLE_LABEL_WIDTH,
  DECISIONS_TOKEN_COMFORTABLE_PAD,
  DECISIONS_TOKEN_PACKED_CARD_WIDTH,
  DECISIONS_TOKEN_PACKED_COLUMNS,
  DECISIONS_TOKEN_PACKED_GAP,
  DECISIONS_TOKEN_PACKED_LABEL_WIDTH,
  DECISIONS_TOKEN_PACKED_PAD,
  DECISIONS_TOKEN_REFERENCE_BOARD_WIDTH,
  decisionsCardHeight,
  decisionsCardsPerRow,
  decisionsFluidCardWidth,
  decisionsTokenGutter,
} from "../src/lib/decisions-token-layout";

const BOARD_375 = DECISIONS_TOKEN_REFERENCE_BOARD_WIDTH;
const BOARD_360 = 360 - 32;
const gutter375 = decisionsTokenGutter(
  BOARD_375,
  DECISIONS_TOKEN_PACKED_LABEL_WIDTH,
  DECISIONS_TOKEN_PACKED_PAD,
);
const gutter360 = decisionsTokenGutter(
  BOARD_360,
  DECISIONS_TOKEN_PACKED_LABEL_WIDTH,
  DECISIONS_TOKEN_PACKED_PAD,
);

assert.equal(DECISIONS_DECISIONS_CARD_WIDTH, 72);
assert.equal(decisionsCardHeight(72), 101);
assert.equal(
  decisionsCardsPerRow(gutter375, 72, 4),
  3,
  "legacy 72px tiles stay 3-wide on a 375 board",
);

const packed375 = decisionsFluidCardWidth(BOARD_375);
assert.equal(packed375, DECISIONS_TOKEN_PACKED_CARD_WIDTH);
assert.ok(packed375 > 40 && packed375 < 50, `375 fluid card ${packed375}`);
assert.equal(
  decisionsCardsPerRow(gutter375, packed375, DECISIONS_TOKEN_PACKED_GAP),
  DECISIONS_TOKEN_PACKED_COLUMNS,
);

const packed360 = decisionsFluidCardWidth(BOARD_360);
assert.equal(
  decisionsCardsPerRow(gutter360, packed360, DECISIONS_TOKEN_PACKED_GAP),
  DECISIONS_TOKEN_PACKED_COLUMNS,
  "Android compact 360 still fits six packed cards",
);

const wraps26Packed = Math.ceil(26 / DECISIONS_TOKEN_PACKED_COLUMNS);
assert.equal(wraps26Packed, 5);
assert.ok(wraps26Packed < Math.ceil(26 / 3));
assert.ok(decisionsCardHeight(packed375) <= 64);

const comfortableGutter = decisionsTokenGutter(
  576,
  DECISIONS_TOKEN_COMFORTABLE_LABEL_WIDTH,
  DECISIONS_TOKEN_COMFORTABLE_PAD,
);
assert.ok(
  decisionsCardsPerRow(
    comfortableGutter,
    DECISIONS_DECISIONS_CARD_WIDTH,
    DECISIONS_TOKEN_COMFORTABLE_GAP,
  ) >= 6,
);

console.log("decisions-token-layout.spec.ts: ok");

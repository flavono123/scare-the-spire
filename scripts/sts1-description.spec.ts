import assert from "node:assert/strict";
import { parseSts1CardText, plainSts1Text } from "../src/lib/sts1/description";

const stats = {
  cost: 1,
  damage: 6,
  block: null,
  magic: null,
  exhaust: false,
  ethereal: false,
  innate: false,
  retain: false,
  nameSuffix: "",
  upgraded: false,
};

const spans = parseSts1CardText("피해를 !D! 줍니다.", stats);
assert.equal(spans.some((span) => span.kind === "text" && span.text.includes("GOLD")), false);
assert.equal(
  spans.filter((span) => span.kind === "text").map((span) => span.kind === "text" ? span.text : "").join(""),
  "피해를 6 줍니다.",
);
assert.equal(plainSts1Text("피해를 !D! 줍니다.", stats), "피해를 6 줍니다.");

console.log("sts1-description.spec.ts: ok");

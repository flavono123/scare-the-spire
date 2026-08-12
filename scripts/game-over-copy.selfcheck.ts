import assert from "node:assert/strict";
import {
  gameLocaleForServiceLocale,
  gameOverFalseWinLabel,
} from "../src/lib/game-over-copy";

assert.equal(gameLocaleForServiceLocale("ko"), "kor");
assert.equal(gameLocaleForServiceLocale("en"), "eng");
assert.equal(gameOverFalseWinLabel("kor"), "승리...?");
assert.equal(gameOverFalseWinLabel("eng"), "Victory...?");

console.log("game-over-copy.selfcheck: ok");

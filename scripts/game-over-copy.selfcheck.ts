import assert from "node:assert/strict";
import {
  gameLocaleForServiceLocale,
  gameOverTrueWinLabel,
} from "../src/lib/game-over-copy";

assert.equal(gameLocaleForServiceLocale("ko"), "kor");
assert.equal(gameLocaleForServiceLocale("en"), "eng");
assert.equal(gameOverTrueWinLabel("kor"), "승리");
assert.equal(gameOverTrueWinLabel("eng"), "Victory");

console.log("game-over-copy.selfcheck: ok");

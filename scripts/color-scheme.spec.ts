import assert from "node:assert/strict";
import {
  COLOR_SCHEME_BOOT_SCRIPT,
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME_PREFERENCE,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  getColorSchemeBootScript,
  parseColorSchemePreference,
  resolveColorScheme,
} from "../src/lib/color-scheme";

assert.equal(parseColorSchemePreference(null), "dark");
assert.equal(parseColorSchemePreference(""), "dark");
assert.equal(parseColorSchemePreference("nope"), "dark");
assert.equal(parseColorSchemePreference("dark"), "dark");
assert.equal(parseColorSchemePreference("light"), "light");
assert.equal(parseColorSchemePreference("system"), "system");
assert.equal(DEFAULT_COLOR_SCHEME_PREFERENCE, "dark");

assert.equal(resolveColorScheme("dark", true), "dark");
assert.equal(resolveColorScheme("dark", false), "dark");
assert.equal(resolveColorScheme("light", false), "light");
assert.equal(resolveColorScheme("system", true), "light");
assert.equal(resolveColorScheme("system", false), "dark");

assert.equal(getColorSchemeBootScript(), COLOR_SCHEME_BOOT_SCRIPT);
assert.match(COLOR_SCHEME_BOOT_SCRIPT, new RegExp(COLOR_SCHEME_STORAGE_KEY));
assert.match(COLOR_SCHEME_BOOT_SCRIPT, new RegExp(THEME_COLOR_DARK));
assert.match(COLOR_SCHEME_BOOT_SCRIPT, new RegExp(THEME_COLOR_LIGHT));
assert.match(COLOR_SCHEME_BOOT_SCRIPT, /stored==="light"\|\|stored==="system"\|\|stored==="dark"\?stored:"dark"/);

console.log("color-scheme.spec.ts: ok");

import assert from "node:assert/strict";
import {
  DEFAULT_PROFILE_CHARACTER_NICKNAMES,
  applyNicknamePools,
  isMissingProfileCharacterNicknamePoolsTable,
  isValidNicknameList,
  mergeNicknamePools,
  nicknamePoolFieldName,
  nicknamePoolRowsFromPools,
  nicknamePoolsAreDefault,
  parseNicknameLines,
  parseNicknamePoolRows,
  parseNicknamePoolsFromFormData,
  serializeNicknameLines,
} from "../src/lib/profile-character-nicknames";

assert.deepEqual(DEFAULT_PROFILE_CHARACTER_NICKNAMES.NECROBINDER.ko, [
  "네바",
  "네크로맨서",
  "네평",
  "골골맘",
  "네크단",
]);
assert.deepEqual(DEFAULT_PROFILE_CHARACTER_NICKNAMES.IRONCLAD.en, [
  "Clad",
  "The Clad",
  "Ironclad",
]);
assert.equal(nicknamePoolsAreDefault(DEFAULT_PROFILE_CHARACTER_NICKNAMES), true);

assert.deepEqual(parseNicknameLines("아클단\n아평\n아클단\n"), ["아클단", "아평"]);
assert.equal(parseNicknameLines(""), null);
assert.equal(parseNicknameLines("x".repeat(21)), null);
assert.equal(serializeNicknameLines(["네바", "네평"]), "네바\n네평");
assert.equal(isValidNicknameList(["네바"]), true);
assert.equal(isValidNicknameList([" 네바"]), false);
assert.equal(isValidNicknameList(["네바", "네바"]), false);

const parsedRows = parseNicknamePoolRows([
  { character_id: "DEFECT", locale: "ko", nicknames: ["디평", "디황"] },
  { character_id: "DEFECT", locale: "en", nicknames: ["Defect"] },
  { character_id: "UNKNOWN", locale: "ko", nicknames: ["nope"] },
  { character_id: "SILENT", locale: "fr", nicknames: ["Silent"] },
]);
assert.deepEqual(parsedRows.DEFECT, { ko: ["디평", "디황"], en: ["Defect"] });
assert.equal(parsedRows.SILENT, undefined);

const merged = mergeNicknamePools(parsedRows);
assert.deepEqual(merged.DEFECT.ko, ["디평", "디황"]);
assert.deepEqual(merged.SILENT.ko, DEFAULT_PROFILE_CHARACTER_NICKNAMES.SILENT.ko);
assert.equal(nicknamePoolsAreDefault(merged), false);

const formData = new FormData();
for (const row of nicknamePoolRowsFromPools(DEFAULT_PROFILE_CHARACTER_NICKNAMES)) {
  formData.set(nicknamePoolFieldName(row.character_id, row.locale), row.nicknames.join("\n"));
}
assert.deepEqual(parseNicknamePoolsFromFormData(formData), DEFAULT_PROFILE_CHARACTER_NICKNAMES);

formData.set(nicknamePoolFieldName("IRONCLAD", "ko"), "");
assert.equal(parseNicknamePoolsFromFormData(formData), null);

const applied = applyNicknamePools(
  [{ id: "NECROBINDER", nicknameOptions: { ko: ["x"], en: ["y"] }, extra: 1 }],
  DEFAULT_PROFILE_CHARACTER_NICKNAMES,
);
assert.deepEqual(applied[0]?.nicknameOptions.ko, DEFAULT_PROFILE_CHARACTER_NICKNAMES.NECROBINDER.ko);
assert.equal(applied[0]?.extra, 1);

assert.equal(
  isMissingProfileCharacterNicknamePoolsTable({ code: "PGRST205", message: "table missing" }),
  true,
);
assert.equal(isMissingProfileCharacterNicknamePoolsTable({ message: "ok" }), false);

console.log("profile-character-nicknames.spec.ts ok");

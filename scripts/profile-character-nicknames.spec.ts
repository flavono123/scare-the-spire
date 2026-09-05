import assert from "node:assert/strict";
import {
  DEFAULT_PROFILE_NICKNAMES,
  isMissingProfileCharacterNicknamePoolsTable,
  isValidNicknameList,
  nicknamePoolFieldName,
  nicknamePoolRowsFromPools,
  nicknamePoolsAreDefault,
  normalizeNicknameLines,
  parseNicknameLines,
  parseNicknamePoolRows,
  parseNicknamePoolsFromFormData,
  pickRandomNickname,
  serializeNicknameLines,
  sortNicknameList,
  shouldRerollProfileNickname,
} from "../src/lib/profile-character-nicknames";

assert.ok(DEFAULT_PROFILE_NICKNAMES.ko.includes("네바"));
assert.ok(DEFAULT_PROFILE_NICKNAMES.ko.includes("아클단"));
assert.ok(DEFAULT_PROFILE_NICKNAMES.ko.includes("디황"));
assert.ok(DEFAULT_PROFILE_NICKNAMES.en.includes("Shiv Silent"));
assert.ok(DEFAULT_PROFILE_NICKNAMES.en.includes("Ironclad"));
assert.equal(nicknamePoolsAreDefault(DEFAULT_PROFILE_NICKNAMES), true);
assert.equal(
  new Set(DEFAULT_PROFILE_NICKNAMES.ko).size,
  DEFAULT_PROFILE_NICKNAMES.ko.length,
);
assert.deepEqual(
  [...DEFAULT_PROFILE_NICKNAMES.ko],
  [...DEFAULT_PROFILE_NICKNAMES.ko].sort((left, right) =>
    left.localeCompare(right, "ko", { numeric: true, sensitivity: "base" }),
  ),
);
assert.deepEqual(
  [...DEFAULT_PROFILE_NICKNAMES.en],
  [...DEFAULT_PROFILE_NICKNAMES.en].sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }),
  ),
);
assert.equal(
  DEFAULT_PROFILE_NICKNAMES.ko.join(", "),
  "골골맘, 네바, 네크단, 네크로맨서, 네평, 디펙터, 디평, 디황, 리평, 리황, 사일단, 사장연, 사평, 아이돌클라스, 아이언클래스, 아이언클레임, 아장연, 아클단, 아평",
);
assert.equal(
  DEFAULT_PROFILE_NICKNAMES.en.join(", "),
  "Clad, Defect, Ironclad, King Reggie, Necro, Necro Binder, Necrobinder, Orb Defect, Regent, Reggie, Shiv Silent, Silent, The Clad, The Defect, The Silent",
);

assert.deepEqual(normalizeNicknameLines("  아평  \n아평\n\n아클단"), ["아평", "아클단"]);
assert.deepEqual(normalizeNicknameLines("아클단\n아평\n아클단\n"), ["아클단", "아평"]);
assert.deepEqual(sortNicknameList(["아평", "아클단"], "ko"), ["아클단", "아평"]);
assert.deepEqual(sortNicknameList(["Silent", "Clad", "The Silent"], "en"), ["Clad", "Silent", "The Silent"]);
assert.deepEqual(parseNicknameLines("  아평  \n아평\n아클단", "ko"), ["아클단", "아평"]);
assert.deepEqual(parseNicknameLines("아클단\n아평\n아클단\n", "ko"), ["아클단", "아평"]);
assert.equal(parseNicknameLines(""), null);
assert.equal(parseNicknameLines("   \n\n"), null);
assert.equal(parseNicknameLines("x".repeat(21)), null);
assert.equal(parseNicknameLines(`  ${"x".repeat(21)}  `), null);
assert.equal(serializeNicknameLines(["네바", "네평"]), "네바\n네평");
assert.equal(isValidNicknameList(["네바"]), true);
assert.equal(isValidNicknameList([" 네바"]), false);
assert.equal(isValidNicknameList(["네바", "네바"]), false);

const parsedRows = parseNicknamePoolRows([
  { character_id: "DEFECT", locale: "ko", nicknames: ["디평", "디황"] },
  { character_id: "DEFECT", locale: "en", nicknames: ["Defect"] },
  { character_id: "IRONCLAD", locale: "ko", nicknames: ["아클단"] },
  { character_id: "UNKNOWN", locale: "ko", nicknames: ["nope"] },
  { character_id: "SILENT", locale: "fr", nicknames: ["Silent"] },
]);
assert.ok(parsedRows.ko.includes("아클단"));
assert.ok(parsedRows.ko.includes("사일단"));
assert.ok(parsedRows.ko.includes("사평"));
assert.ok(parsedRows.ko.includes("디평"));
assert.ok(parsedRows.en.includes("Defect"));
assert.ok(parsedRows.en.includes("Silent"));
assert.equal(nicknamePoolsAreDefault(parsedRows), false);

const formData = new FormData();
formData.set(nicknamePoolFieldName("ko"), DEFAULT_PROFILE_NICKNAMES.ko.join("\n"));
formData.set(nicknamePoolFieldName("en"), DEFAULT_PROFILE_NICKNAMES.en.join("\n"));
assert.deepEqual(parseNicknamePoolsFromFormData(formData), DEFAULT_PROFILE_NICKNAMES);

formData.set(nicknamePoolFieldName("ko"), "");
assert.equal(parseNicknamePoolsFromFormData(formData), null);

const trimmedFormData = new FormData();
trimmedFormData.set(nicknamePoolFieldName("ko"), "  아평  \n아평\n\n아클단");
trimmedFormData.set(nicknamePoolFieldName("en"), " Clad \nClad\nSilent");
assert.deepEqual(parseNicknamePoolsFromFormData(trimmedFormData), {
  ko: ["아클단", "아평"],
  en: ["Clad", "Silent"],
});

const rows = nicknamePoolRowsFromPools(DEFAULT_PROFILE_NICKNAMES);
assert.equal(rows.length, 10);
assert.deepEqual(rows[0]?.nicknames, [...DEFAULT_PROFILE_NICKNAMES.ko]);
assert.deepEqual(rows[1]?.nicknames, [...DEFAULT_PROFILE_NICKNAMES.en]);
const unsortedRows = nicknamePoolRowsFromPools({
  ko: ["아평", "아클단"],
  en: ["Silent", "Clad"],
});
assert.deepEqual(unsortedRows[0]?.nicknames, ["아클단", "아평"]);
assert.deepEqual(unsortedRows[1]?.nicknames, ["Clad", "Silent"]);

assert.equal(pickRandomNickname(["네바"], "닉"), "네바");
assert.equal(pickRandomNickname(["네바", "아클단"], "닉", "네바"), "아클단");
assert.equal(pickRandomNickname([], "닉"), "닉");

assert.equal(
  shouldRerollProfileNickname({
    nicknameLocked: false,
    nickname: "네바",
    pool: DEFAULT_PROFILE_NICKNAMES.ko,
    currentKind: "character",
    currentId: "NECROBINDER",
    nextKind: "boss",
    nextId: "KAISER_CRAB_BOSS",
  }),
  true,
);
assert.equal(
  shouldRerollProfileNickname({
    nicknameLocked: true,
    nickname: "네바",
    pool: DEFAULT_PROFILE_NICKNAMES.ko,
    currentKind: "character",
    currentId: "NECROBINDER",
    nextKind: "boss",
    nextId: "KAISER_CRAB_BOSS",
  }),
  false,
);
assert.equal(
  shouldRerollProfileNickname({
    nicknameLocked: false,
    nickname: "내닉",
    pool: DEFAULT_PROFILE_NICKNAMES.ko,
    currentKind: "character",
    currentId: "NECROBINDER",
    nextKind: "character",
    nextId: "SILENT",
  }),
  false,
);
assert.equal(
  shouldRerollProfileNickname({
    nicknameLocked: false,
    nickname: "네바",
    pool: DEFAULT_PROFILE_NICKNAMES.ko,
    currentKind: "boss",
    currentId: "KAISER_CRAB_BOSS",
    nextKind: "boss",
    nextId: "KAISER_CRAB_BOSS",
  }),
  false,
);

assert.equal(
  isMissingProfileCharacterNicknamePoolsTable({ code: "PGRST205", message: "table missing" }),
  true,
);
assert.equal(isMissingProfileCharacterNicknamePoolsTable({ message: "ok" }), false);

console.log("profile-character-nicknames.spec.ts ok");

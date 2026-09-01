import assert from "node:assert/strict";
import {
  PROFILE_EXCLUDED_PALETTE_ID,
  PROFILE_PALETTE_PAIRS,
  isProfilePaletteId,
  profilePaletteDiagonalStyle,
  resolveProfileDuotone,
} from "../src/lib/profile-palettes";
import {
  DEFAULT_USER_PROFILE,
  normalizeUserProfile,
  parseStoredUserProfile,
  profileAvatarTokenUrl,
} from "../src/lib/user-profile";

assert.equal(PROFILE_EXCLUDED_PALETTE_ID, "ivory-sky");
assert.equal(PROFILE_PALETTE_PAIRS.length, 15);
assert.equal(PROFILE_PALETTE_PAIRS.some((pair) => pair.id === "ivory-sky"), false);
assert.equal(isProfilePaletteId("ivory-sky"), false);
assert.equal(isProfilePaletteId("sage-blush"), true);

const migrated = parseStoredUserProfile(JSON.stringify({
  nickname: "네바",
  characterId: "NECROBINDER",
  petId: "OSTY",
  petSkinId: null,
  ancientId: "OROBAS",
}));
assert.equal(migrated.avatarKind, "character");
assert.equal(migrated.avatarId, "NECROBINDER");
assert.equal(migrated.paletteId, null);
assert.equal(migrated.paletteSwapped, false);
assert.equal(profileAvatarTokenUrl(migrated), "/images/sts2/characters/character_icon_necrobinder.webp");

const boss = normalizeUserProfile({
  ...DEFAULT_USER_PROFILE,
  avatarKind: "boss",
  avatarId: "KAISER_CRAB_BOSS",
  paletteId: "ivory-sky",
  paletteSwapped: true,
});
assert.equal(boss.avatarKind, "boss");
assert.equal(boss.avatarId, "KAISER_CRAB_BOSS");
assert.equal(boss.paletteId, null);
assert.equal(boss.paletteSwapped, false);
assert.equal(profileAvatarTokenUrl(boss), "/images/sts2/bosses/kaiser_crab_boss.webp");

const invalidBoss = normalizeUserProfile({
  characterId: "SILENT",
  avatarKind: "boss",
  avatarId: "NOT_A_BOSS",
});
assert.equal(invalidBoss.avatarKind, "character");
assert.equal(invalidBoss.avatarId, "SILENT");
assert.equal(invalidBoss.characterId, "SILENT");

const swapped = normalizeUserProfile({
  characterId: "DEFECT",
  avatarKind: "character",
  avatarId: "DEFECT",
  paletteId: "carmine-ink",
  paletteSwapped: true,
});
assert.deepEqual(resolveProfileDuotone(swapped), {
  shadow: "#0F1A14",
  highlight: "#CC1236",
});
assert.deepEqual(resolveProfileDuotone({ paletteId: null, paletteSwapped: false }), null);

const diagonal = profilePaletteDiagonalStyle("#111111", "#EEEEEE", false);
assert.equal(diagonal.backgroundImage, "linear-gradient(to bottom left, #111111 50%, #EEEEEE 50%)");
assert.equal(
  profilePaletteDiagonalStyle("#111111", "#EEEEEE", true).backgroundImage,
  "linear-gradient(to bottom left, #EEEEEE 50%, #111111 50%)",
);

console.log("user-profile.spec.ts: ok");

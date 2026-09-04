export const PROFILE_CHARACTER_NICKNAME_POOLS_TABLE = "profile_character_nickname_pools";

export const PROFILE_NICKNAME_LOCALES = ["ko", "en"] as const;
export type ProfileNicknameLocale = (typeof PROFILE_NICKNAME_LOCALES)[number];

export const PROFILE_CHARACTER_NICKNAME_IDS = [
  "IRONCLAD",
  "SILENT",
  "REGENT",
  "NECROBINDER",
  "DEFECT",
] as const;
export type ProfileCharacterNicknameId = (typeof PROFILE_CHARACTER_NICKNAME_IDS)[number];

export const PROFILE_NICKNAME_MIN_CHARS = 1;
export const PROFILE_NICKNAME_MAX_CHARS = 20;
export const PROFILE_NICKNAME_POOL_MIN = 1;
export const PROFILE_NICKNAME_POOL_MAX = 50;

export type ProfileCharacterNicknamePools = Record<
  ProfileCharacterNicknameId,
  Record<ProfileNicknameLocale, readonly string[]>
>;
export type PartialProfileCharacterNicknamePools = Partial<
  Record<ProfileCharacterNicknameId, Partial<Record<ProfileNicknameLocale, readonly string[]>>>
>;

export const DEFAULT_PROFILE_CHARACTER_NICKNAMES: ProfileCharacterNicknamePools = {
  IRONCLAD: {
    ko: ["아클단", "아평", "아이언클래스", "아이언클레임", "아이돌클라스", "아장연"],
    en: ["Clad", "The Clad", "Ironclad"],
  },
  SILENT: {
    ko: ["사일단", "사평", "사장연"],
    en: ["Silent", "The Silent", "Shiv Silent"],
  },
  REGENT: {
    ko: ["리황", "리평"],
    en: ["Regent", "Reggie", "King Reggie"],
  },
  NECROBINDER: {
    ko: ["네바", "네크로맨서", "네평", "골골맘", "네크단"],
    en: ["Necro", "Necrobinder", "Necro Binder"],
  },
  DEFECT: {
    ko: ["디평", "디펙터", "디황"],
    en: ["Defect", "The Defect", "Orb Defect"],
  },
};

export function isProfileNicknameLocale(value: string | null | undefined): value is ProfileNicknameLocale {
  return value === "ko" || value === "en";
}

export function isProfileCharacterNicknameId(
  value: string | null | undefined,
): value is ProfileCharacterNicknameId {
  return PROFILE_CHARACTER_NICKNAME_IDS.some((id) => id === value);
}

export function nicknamePoolFieldName(
  characterId: ProfileCharacterNicknameId,
  locale: ProfileNicknameLocale,
): string {
  return `nicknames__${characterId}__${locale}`;
}

export function parseNicknameLines(value: string): string[] | null {
  const seen = new Set<string>();
  const nicknames: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const nickname = line.trim();
    if (!nickname) continue;
    if (
      nickname.length < PROFILE_NICKNAME_MIN_CHARS
      || nickname.length > PROFILE_NICKNAME_MAX_CHARS
    ) {
      return null;
    }
    if (seen.has(nickname)) continue;
    seen.add(nickname);
    nicknames.push(nickname);
  }
  if (
    nicknames.length < PROFILE_NICKNAME_POOL_MIN
    || nicknames.length > PROFILE_NICKNAME_POOL_MAX
  ) {
    return null;
  }
  return nicknames;
}

export function serializeNicknameLines(nicknames: readonly string[]): string {
  return nicknames.join("\n");
}

export function isValidNicknameList(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.length < PROFILE_NICKNAME_POOL_MIN || value.length > PROFILE_NICKNAME_POOL_MAX) {
    return false;
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return false;
    const nickname = item.trim();
    if (nickname !== item) return false;
    if (
      nickname.length < PROFILE_NICKNAME_MIN_CHARS
      || nickname.length > PROFILE_NICKNAME_MAX_CHARS
    ) {
      return false;
    }
    if (seen.has(nickname)) return false;
    seen.add(nickname);
  }
  return true;
}

export function parseNicknamePoolRows(rows: unknown): PartialProfileCharacterNicknamePools {
  if (!Array.isArray(rows)) return {};
  const parsed: PartialProfileCharacterNicknamePools = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const characterId = typeof record.character_id === "string" ? record.character_id : "";
    const locale = typeof record.locale === "string" ? record.locale : "";
    if (!isProfileCharacterNicknameId(characterId) || !isProfileNicknameLocale(locale)) continue;
    if (!isValidNicknameList(record.nicknames)) continue;
    const current = parsed[characterId] ?? {};
    parsed[characterId] = { ...current, [locale]: record.nicknames };
  }
  return parsed;
}

export function mergeNicknamePools(
  overrides: PartialProfileCharacterNicknamePools = {},
  base: ProfileCharacterNicknamePools = DEFAULT_PROFILE_CHARACTER_NICKNAMES,
): ProfileCharacterNicknamePools {
  const merged = {} as ProfileCharacterNicknamePools;
  for (const characterId of PROFILE_CHARACTER_NICKNAME_IDS) {
    const override = overrides[characterId];
    const ko = override?.ko;
    const en = override?.en;
    merged[characterId] = {
      ko: isValidNicknameList(ko) ? ko : base[characterId].ko,
      en: isValidNicknameList(en) ? en : base[characterId].en,
    };
  }
  return merged;
}

export function parseNicknamePoolsFromFormData(formData: FormData): ProfileCharacterNicknamePools | null {
  const parsed: PartialProfileCharacterNicknamePools = {};
  for (const characterId of PROFILE_CHARACTER_NICKNAME_IDS) {
    const ko = parseNicknameLines(String(formData.get(nicknamePoolFieldName(characterId, "ko")) ?? ""));
    const en = parseNicknameLines(String(formData.get(nicknamePoolFieldName(characterId, "en")) ?? ""));
    if (!ko || !en) return null;
    parsed[characterId] = { ko, en };
  }
  return mergeNicknamePools(parsed);
}

export function nicknamePoolRowsFromPools(pools: ProfileCharacterNicknamePools): Array<{
  character_id: ProfileCharacterNicknameId;
  locale: ProfileNicknameLocale;
  nicknames: string[];
}> {
  return PROFILE_CHARACTER_NICKNAME_IDS.flatMap((characterId) =>
    PROFILE_NICKNAME_LOCALES.map((locale) => ({
      character_id: characterId,
      locale,
      nicknames: [...pools[characterId][locale]],
    })),
  );
}

export function nicknamePoolsAreDefault(pools: ProfileCharacterNicknamePools): boolean {
  return PROFILE_CHARACTER_NICKNAME_IDS.every((characterId) =>
    PROFILE_NICKNAME_LOCALES.every((locale) =>
      listsEqual(pools[characterId][locale], DEFAULT_PROFILE_CHARACTER_NICKNAMES[characterId][locale]),
    ),
  );
}

export function applyNicknamePools<T extends {
  id: string;
  nicknameOptions: Record<ProfileNicknameLocale, readonly string[]>;
}>(characters: T[], pools: ProfileCharacterNicknamePools): T[] {
  return characters.map((character) => {
    if (!isProfileCharacterNicknameId(character.id)) return character;
    return {
      ...character,
      nicknameOptions: pools[character.id],
    };
  });
}

export function isMissingProfileCharacterNicknamePoolsTable(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /profile_character_nickname_pools/i.test(error.message ?? "");
}

function listsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

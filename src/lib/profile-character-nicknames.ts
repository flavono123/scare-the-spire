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

export type ProfileNicknamePools = Record<ProfileNicknameLocale, readonly string[]>;
export type ProfileCharacterNicknamePools = Record<
  ProfileCharacterNicknameId,
  Record<ProfileNicknameLocale, readonly string[]>
>;
export type PartialProfileCharacterNicknamePools = Partial<
  Record<ProfileCharacterNicknameId, Partial<Record<ProfileNicknameLocale, readonly string[]>>>
>;

const DEFAULT_PROFILE_CHARACTER_NICKNAMES: ProfileCharacterNicknamePools = {
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

export const DEFAULT_PROFILE_NICKNAMES: ProfileNicknamePools = flattenCharacterNicknamePools(
  DEFAULT_PROFILE_CHARACTER_NICKNAMES,
);

export function isProfileNicknameLocale(value: string | null | undefined): value is ProfileNicknameLocale {
  return value === "ko" || value === "en";
}

export function isProfileCharacterNicknameId(
  value: string | null | undefined,
): value is ProfileCharacterNicknameId {
  return PROFILE_CHARACTER_NICKNAME_IDS.some((id) => id === value);
}

export function nicknamePoolFieldName(locale: ProfileNicknameLocale): string {
  return `nicknames__${locale}`;
}

export function normalizeNicknameLines(value: string): string[] {
  const seen = new Set<string>();
  const nicknames: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const nickname = line.trim();
    if (!nickname) continue;
    if (seen.has(nickname)) continue;
    seen.add(nickname);
    nicknames.push(nickname);
  }
  return nicknames;
}

export function sortNicknameList(
  nicknames: readonly string[],
  locale: ProfileNicknameLocale,
): string[] {
  return [...nicknames].sort((left, right) =>
    left.localeCompare(right, locale, { numeric: true, sensitivity: "base" }),
  );
}

export function parseNicknameLines(
  value: string,
  locale: ProfileNicknameLocale = "ko",
): string[] | null {
  const nicknames = sortNicknameList(normalizeNicknameLines(value), locale);
  return isValidNicknameList(nicknames) ? nicknames : null;
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

export function parseNicknamePoolRows(rows: unknown): ProfileNicknamePools {
  if (!Array.isArray(rows)) return DEFAULT_PROFILE_NICKNAMES;
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
  if (Object.keys(parsed).length === 0) return DEFAULT_PROFILE_NICKNAMES;
  return flattenCharacterNicknamePools(mergeCharacterNicknamePools(parsed));
}

export function parseNicknamePoolsFromFormData(formData: FormData): ProfileNicknamePools | null {
  const ko = parseNicknameLines(String(formData.get(nicknamePoolFieldName("ko")) ?? ""), "ko");
  const en = parseNicknameLines(String(formData.get(nicknamePoolFieldName("en")) ?? ""), "en");
  if (!ko || !en) return null;
  return { ko, en };
}

export function nicknamePoolRowsFromPools(pools: ProfileNicknamePools): Array<{
  character_id: ProfileCharacterNicknameId;
  locale: ProfileNicknameLocale;
  nicknames: string[];
}> {
  return PROFILE_CHARACTER_NICKNAME_IDS.flatMap((characterId) =>
    PROFILE_NICKNAME_LOCALES.map((locale) => ({
      character_id: characterId,
      locale,
      nicknames: sortNicknameList(pools[locale], locale),
    })),
  );
}

export function nicknamePoolsAreDefault(pools: ProfileNicknamePools): boolean {
  return PROFILE_NICKNAME_LOCALES.every((locale) =>
    listsEqual(pools[locale], DEFAULT_PROFILE_NICKNAMES[locale]),
  );
}

export function pickRandomNickname(
  pool: readonly string[],
  fallback: string,
  exclude?: string,
): string {
  if (!pool.length) return fallback;
  const candidates = exclude && pool.length > 1
    ? pool.filter((nickname) => nickname !== exclude)
    : pool;
  const pickFrom = candidates.length ? candidates : pool;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? fallback;
}

export function shouldRerollProfileNickname(options: {
  nicknameLocked: boolean;
  nickname: string;
  pool: readonly string[];
  currentKind: string;
  currentId: string;
  nextKind: string;
  nextId: string;
}): boolean {
  if (options.nextKind === options.currentKind && options.nextId === options.currentId) {
    return false;
  }
  if (options.nicknameLocked) return false;
  const nickname = options.nickname.trim();
  if (nickname && !options.pool.includes(nickname)) return false;
  return true;
}

export function isMissingProfileCharacterNicknamePoolsTable(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /profile_character_nickname_pools/i.test(error.message ?? "");
}

function mergeCharacterNicknamePools(
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

function flattenCharacterNicknamePools(pools: ProfileCharacterNicknamePools): ProfileNicknamePools {
  return {
    ko: sortNicknameList(
      uniqueNicknames(PROFILE_CHARACTER_NICKNAME_IDS.flatMap((id) => pools[id].ko)),
      "ko",
    ),
    en: sortNicknameList(
      uniqueNicknames(PROFILE_CHARACTER_NICKNAME_IDS.flatMap((id) => pools[id].en)),
      "en",
    ),
  };
}

function uniqueNicknames(nicknames: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const nickname of nicknames) {
    if (seen.has(nickname)) continue;
    seen.add(nickname);
    unique.push(nickname);
  }
  return unique;
}

function listsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

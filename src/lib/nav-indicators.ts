export const NAV_INDICATORS_TABLE = "nav_indicators";

export const NAV_INDICATOR_ENVS = ["production", "development"] as const;

export type NavIndicatorEnv = (typeof NAV_INDICATOR_ENVS)[number];

export const NAV_INDICATOR_TARGETS = ["patch_notes", "toy_box"] as const;

export type NavIndicatorTarget = (typeof NAV_INDICATOR_TARGETS)[number];

export type NavIndicatorFlags = {
  patchNotes: boolean;
  toyBox: boolean;
};

export type NavIndicatorRow = NavIndicatorFlags & {
  env: NavIndicatorEnv;
};

export const NAV_INDICATORS_OFF: NavIndicatorFlags = {
  patchNotes: false,
  toyBox: false,
};

export const NAV_INDICATORS_CACHE_MS = 60_000;

const CACHE_KEY_PREFIX = "sts-nav-indicators:";

export function isNavIndicatorEnv(value: string): value is NavIndicatorEnv {
  return (NAV_INDICATOR_ENVS as readonly string[]).includes(value);
}

export function isNavIndicatorTarget(value: string): value is NavIndicatorTarget {
  return (NAV_INDICATOR_TARGETS as readonly string[]).includes(value);
}

export function navIndicatorFlagsFromRow(
  row: { patch_notes?: unknown; toy_box?: unknown } | null | undefined,
): NavIndicatorFlags {
  return {
    patchNotes: row?.patch_notes === true,
    toyBox: row?.toy_box === true,
  };
}

export function isMissingNavIndicatorsTable(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /nav_indicators/i.test(error.message ?? "");
}

type CacheEnvelope = {
  at: number;
  flags: NavIndicatorFlags;
};

export function navIndicatorCacheKey(env: string): string {
  return `${CACHE_KEY_PREFIX}${env}`;
}

export function readNavIndicatorCache(
  storage: Pick<Storage, "getItem">,
  env: string,
  now: number,
): NavIndicatorFlags | null {
  try {
    const raw = storage.getItem(navIndicatorCacheKey(env));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope>;
    if (typeof parsed.at !== "number" || now - parsed.at > NAV_INDICATORS_CACHE_MS) return null;
    return navIndicatorFlagsFromRow({
      patch_notes: parsed.flags?.patchNotes,
      toy_box: parsed.flags?.toyBox,
    });
  } catch {
    return null;
  }
}

export function writeNavIndicatorCache(
  storage: Pick<Storage, "setItem">,
  env: string,
  flags: NavIndicatorFlags,
  now: number,
): void {
  try {
    const envelope: CacheEnvelope = { at: now, flags };
    storage.setItem(navIndicatorCacheKey(env), JSON.stringify(envelope));
  } catch {
    // Private browsing can reject sessionStorage writes.
  }
}

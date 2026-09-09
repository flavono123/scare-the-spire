import { cache } from "react";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import type { Metadata } from "next";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { withKoreanSearchCanonical } from "@/lib/search-canonical";
import { sts1GameLocale } from "./locale";
import type {
  Sts1Card,
  Sts1Keyword,
  Sts1Potion,
  Sts1Relic,
  Sts1UiLabels,
} from "./types";

const DATA_ROOT = path.join(process.cwd(), "data", "sts1");

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_ROOT, relativePath), "utf8")) as T;
}

type RawCard = Omit<Sts1Card, "name" | "nameEn" | "description" | "upgradeDescription" | "extendedDescription">;
type RawRelic = Omit<Sts1Relic, "name" | "nameEn" | "flavor" | "description" | "descriptions" | "hasLargeArt">;
type RawPotion = Omit<Sts1Potion, "name" | "nameEn" | "description" | "descriptions">;

type CardLoc = {
  name: string;
  description: string;
  upgradeDescription: string;
  extendedDescription: string[];
};

type RelicLoc = {
  name: string;
  flavor: string;
  description: string;
  descriptions: string[];
};

type PotionLoc = {
  name: string;
  description: string;
  descriptions: string[];
};

type UiTable = {
  TEXT?: string[];
};

type Sts1UiFile = {
  CardLibraryScreen?: UiTable;
  CardLibSortHeader?: UiTable;
  RelicViewScreen?: UiTable;
  PotionViewScreen?: UiTable;
  SingleCardViewPopup?: UiTable;
  MenuPanels?: UiTable;
};

function matchesSlug(
  row: { slug: string; legacySlugs: string[] },
  id: string,
): boolean {
  const needle = id.toLowerCase();
  return row.slug === needle || row.legacySlugs.some((slug) => slug === needle);
}

export const getSts1Cards = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Card[]> => {
  const locale = sts1GameLocale(gameLocale);
  const [rows, loc, eng] = await Promise.all([
    readJson<RawCard[]>("cards.json"),
    readJson<Record<string, CardLoc>>(`localization/${locale}/cards.json`),
    locale === "eng"
      ? Promise.resolve(null)
      : readJson<Record<string, CardLoc>>("localization/eng/cards.json"),
  ]);
  return rows.map((row) => {
    const text = loc[row.id] ?? {
      name: row.id,
      description: "",
      upgradeDescription: "",
      extendedDescription: [],
    };
    return {
      ...row,
      ...text,
      nameEn: eng?.[row.id]?.name ?? text.name,
    };
  });
});

export const getSts1Relics = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Relic[]> => {
  const locale = sts1GameLocale(gameLocale);
  const [rows, loc, eng] = await Promise.all([
    readJson<RawRelic[]>("relics.json"),
    readJson<Record<string, RelicLoc>>(`localization/${locale}/relics.json`),
    locale === "eng"
      ? Promise.resolve(null)
      : readJson<Record<string, RelicLoc>>("localization/eng/relics.json"),
  ]);
  return rows.map((row) => {
    const text = loc[row.id] ?? {
      name: row.id,
      flavor: "",
      description: "",
      descriptions: [],
    };
    return {
      ...row,
      ...text,
      nameEn: eng?.[row.id]?.name ?? text.name,
      hasLargeArt: existsSync(path.join(process.cwd(), "public/images/sts1/relics-large", `${row.slug}.webp`)),
    };
  });
});

export const getSts1Potions = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Potion[]> => {
  const locale = sts1GameLocale(gameLocale);
  const [rows, loc, eng] = await Promise.all([
    readJson<RawPotion[]>("potions.json"),
    readJson<Record<string, PotionLoc>>(`localization/${locale}/potions.json`),
    locale === "eng"
      ? Promise.resolve(null)
      : readJson<Record<string, PotionLoc>>("localization/eng/potions.json"),
  ]);
  return rows.map((row) => {
    const text = loc[row.id] ?? {
      name: row.id,
      description: "",
      descriptions: [],
    };
    return {
      ...row,
      ...text,
      nameEn: eng?.[row.id]?.name ?? text.name,
    };
  });
});

export const getSts1Keywords = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Keyword[]> => {
  const locale = sts1GameLocale(gameLocale);
  const raw = await readJson<Record<string, Record<string, { NAMES?: string[]; DESCRIPTION?: string }>>>(
    `localization/${locale}/keywords.json`,
  );
  const dictionary = raw["Game Dictionary"] ?? Object.values(raw)[0] ?? {};
  return Object.entries(dictionary)
    .filter((entry): entry is [string, { NAMES: string[]; DESCRIPTION?: string }] => (
      Array.isArray(entry[1]?.NAMES) && (entry[1]?.NAMES.length ?? 0) > 0 && entry[0] !== "TODO"
    ))
    .map(([id, entry]) => ({
      id,
      names: entry.NAMES,
      description: entry.DESCRIPTION ?? "",
    }));
});

export async function getSts1Card(id: string, gameLocale: GameLocale = "kor"): Promise<Sts1Card | undefined> {
  const cards = await getSts1Cards(gameLocale);
  return cards.find((card) => matchesSlug(card, id));
}

export async function getSts1Relic(id: string, gameLocale: GameLocale = "kor"): Promise<Sts1Relic | undefined> {
  const relics = await getSts1Relics(gameLocale);
  return relics.find((relic) => matchesSlug(relic, id));
}

export async function getSts1Potion(id: string, gameLocale: GameLocale = "kor"): Promise<Sts1Potion | undefined> {
  const potions = await getSts1Potions(gameLocale);
  return potions.find((potion) => matchesSlug(potion, id));
}

function stripColon(label: string | undefined): string {
  return (label ?? "").replace(/:$/, "");
}

export const getSts1UiLabels = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1UiLabels> => {
  const locale = sts1GameLocale(gameLocale);
  const [ui, characters] = await Promise.all([
    readJson<Sts1UiFile>(`localization/${locale}/ui.json`),
    readJson<Sts1UiLabels["characters"]>(`localization/${locale}/characters.json`),
  ]);
  const menu = ui.MenuPanels?.TEXT ?? [];
  const library = ui.CardLibraryScreen?.TEXT ?? [];
  const sort = ui.CardLibSortHeader?.TEXT ?? [];
  const popup = ui.SingleCardViewPopup?.TEXT ?? [];
  const relics = ui.RelicViewScreen?.TEXT ?? [];
  const potions = ui.PotionViewScreen?.TEXT ?? [];
  return {
    cardLibraryTitle: menu[9] || "Card Library",
    relicCollectionTitle: menu[12] || "Relic Collection",
    potionLabTitle: menu[menu.length - 2] || "Potion Lab",
    viewUpgrades: library[7] || popup[6] || "View Upgrade",
    betaArt: popup[14] || "Beta Art",
    types: {
      attack: popup[0] || "Attack",
      skill: popup[1] || "Skill",
      power: popup[2] || "Power",
      curse: popup[3] || library[5] || "Curse",
      status: popup[7] || library[6] || "Status",
    },
    extras: {
      colorless: library[4] || "Colorless",
      curse: library[5] || popup[3] || "Curses",
      status: library[6] || popup[7] || "Statuses",
      special: locale === "kor" ? "특수" : "Special",
    },
    sort: {
      rarity: sort[0] || "Rarity",
      type: sort[1] || "Type",
      name: sort[2] || "A-Z",
      cost: sort[3] || "Cost",
    },
    relicTiers: {
      starter: stripColon(relics[1]) || "Starter",
      common: stripColon(relics[3]) || "Common",
      uncommon: stripColon(relics[5]) || "Uncommon",
      rare: stripColon(relics[7]) || "Rare",
      boss: stripColon(relics[9]) || "Boss",
      special: stripColon(relics[11]) || "Event",
      shop: stripColon(relics[13]) || "Shop",
    },
    relicTierDescriptions: {
      starter: relics[2] || "",
      common: relics[4] || "",
      uncommon: relics[6] || "",
      rare: relics[8] || "",
      boss: relics[10] || "",
      special: relics[12] || "",
      shop: relics[14] || "",
    },
    potionRarities: {
      common: stripColon(potions[1]) || "Common",
      uncommon: stripColon(potions[3]) || "Uncommon",
      rare: stripColon(potions[5]) || "Rare",
    },
    potionRarityDescriptions: {
      common: potions[2] || "",
      uncommon: potions[4] || "",
      rare: potions[6] || "",
    },
    characters,
    shared: locale === "kor" ? "공용" : "Shared",
  };
});

export function getSts1Metadata(
  serviceLocale: ServiceLocale,
  title: string,
  canonicalPath: string,
): Metadata {
  const messages = serviceMessages[serviceLocale];
  return withKoreanSearchCanonical(
    {
      title: {
        absolute: `${title} — ${serviceLocale === "ko" ? "슬레이 더 스파이어" : "Slay the Spire"} — ${messages.brand}`,
      },
      description: serviceLocale === "ko"
        ? `슬레이 더 스파이어 ${title}`
        : `Slay the Spire ${title}.`,
    },
    canonicalPath,
  );
}

export function sts1RouteIds<T extends { slug: string; legacySlugs: string[] }>(
  rows: T[],
): { id: string }[] {
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.slug);
    for (const slug of row.legacySlugs) ids.add(slug);
  }
  return [...ids].map((id) => ({ id }));
}

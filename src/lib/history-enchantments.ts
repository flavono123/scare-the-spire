import engEnchantments from "../../data/sts2/eng/enchantments.json";
import korEnchantments from "../../data/sts2/kor/enchantments.json";
import type { CodexEnchantment } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  getEnchantAddedKeywords,
  getEnchantForcedCost,
  getEnchantRemovedKeywords,
  getEnchantStatModifier,
  shouldShowAmount,
  substituteAmount,
} from "@/lib/sts2-enchant-rules";

interface RawEnchantment {
  id: string;
  name: string;
  extra_card_text?: string | null;
  image_url?: string | null;
}

const BY_LOCALE = {
  kor: korEnchantments as RawEnchantment[],
  eng: engEnchantments as RawEnchantment[],
} as const;

function enchantmentIdKey(id: string): string {
  return id.toUpperCase().replace(/^ENCHANTMENT\./, "");
}

function indexFor(locale: "kor" | "eng"): Map<string, RawEnchantment> {
  return new Map(
    BY_LOCALE[locale].map((row) => [enchantmentIdKey(row.id), row]),
  );
}

const INDEX = {
  kor: indexFor("kor"),
  eng: indexFor("eng"),
};

function catalogLocale(locale: GameLocale | ServiceLocale): "kor" | "eng" {
  return locale === "eng" || locale === "en" ? "eng" : "kor";
}

export function lookupHistoryEnchantment(
  id: string | null | undefined,
  locale: GameLocale | ServiceLocale = "kor",
): RawEnchantment | undefined {
  if (!id) return undefined;
  const table = INDEX[catalogLocale(locale)];
  const key = enchantmentIdKey(id);
  return table.get(key) ?? INDEX.eng.get(key) ?? INDEX.kor.get(key);
}

export function historyEnchantmentImageUrl(
  id: string | null | undefined,
): string | null {
  const row = lookupHistoryEnchantment(id, "eng");
  if (row?.image_url) return row.image_url;
  if (!id) return null;
  return `/images/sts2/enchantments/${enchantmentIdKey(id).toLowerCase()}.webp`;
}

function enchantmentStub(id: string): CodexEnchantment {
  return {
    id: enchantmentIdKey(id),
    name: "",
    nameEn: "",
    description: "",
    descriptionEn: "",
    descriptionRaw: null,
    descriptionRawEn: null,
    extraCardText: null,
    extraCardTextEn: null,
    vars: {},
    cardType: null,
    isStackable: false,
    imageUrl: null,
  };
}

export function historyCardEnchantmentTileProps(
  enchantmentId: string | null | undefined,
  amount: number | undefined,
  locale: GameLocale | ServiceLocale = "kor",
): {
  enchantmentImageUrl: string | null;
  enchantmentLabel: string | null;
  enchantmentAmount: number | null;
  forcedCost: number | null;
  enchantAddedKeywords: string[];
  enchantRemovedKeywords: string[];
  descriptionSuffix: string | null;
  enchantStatMod: ReturnType<typeof getEnchantStatModifier> | null;
} | null {
  if (!enchantmentId) return null;
  const row = lookupHistoryEnchantment(enchantmentId, locale);
  const stub = enchantmentStub(enchantmentId);
  const resolvedAmount = amount ?? 0;
  const extraText = substituteAmount(
    row?.extra_card_text ?? null,
    resolvedAmount,
    { asEnergyIcon: enchantmentIdKey(enchantmentId) === "SOWN" },
  );
  return {
    enchantmentImageUrl: historyEnchantmentImageUrl(enchantmentId),
    enchantmentLabel: row?.name ?? enchantmentIdKey(enchantmentId),
    enchantmentAmount: shouldShowAmount(stub) ? resolvedAmount : null,
    forcedCost: getEnchantForcedCost(stub),
    enchantAddedKeywords: getEnchantAddedKeywords(stub, resolvedAmount),
    enchantRemovedKeywords: getEnchantRemovedKeywords(stub),
    descriptionSuffix: extraText,
    enchantStatMod: getEnchantStatModifier(stub, resolvedAmount),
  };
}

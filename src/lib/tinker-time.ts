import { bakeDescription } from "./codex-bake";
import type { CardTypeKo, CodexCard } from "./codex-types";

export const MAD_SCIENCE_CARD_ID = "MAD_SCIENCE";

export type TinkerCardType = "ATTACK" | "SKILL" | "POWER";
export type TinkerRiderId =
  | "SAPPING"
  | "VIOLENCE"
  | "CHOKING"
  | "ENERGIZED"
  | "WISDOM"
  | "CHAOS"
  | "EXPERTISE"
  | "CURIOUS"
  | "IMPROVEMENT";

export const TINKER_CARD_TYPES: readonly TinkerCardType[] = [
  "ATTACK",
  "SKILL",
  "POWER",
];

export const MAD_SCIENCE_CARD_ID_BY_TYPE: Record<TinkerCardType, string> = {
  ATTACK: `${MAD_SCIENCE_CARD_ID}_ATTACK`,
  SKILL: `${MAD_SCIENCE_CARD_ID}_SKILL`,
  POWER: `${MAD_SCIENCE_CARD_ID}_POWER`,
};

export const TINKER_CARD_TYPE_IDS: ReadonlySet<TinkerCardType> = new Set(TINKER_CARD_TYPES);

export const TINKER_RIDER_IDS_BY_TYPE = {
  ATTACK: ["SAPPING", "VIOLENCE", "CHOKING"],
  SKILL: ["ENERGIZED", "WISDOM", "CHAOS"],
  POWER: ["EXPERTISE", "CURIOUS", "IMPROVEMENT"],
} as const satisfies Record<TinkerCardType, readonly TinkerRiderId[]>;

export const TINKER_RIDER_IDS: readonly TinkerRiderId[] = [
  "SAPPING",
  "VIOLENCE",
  "CHOKING",
  "ENERGIZED",
  "WISDOM",
  "CHAOS",
  "EXPERTISE",
  "CURIOUS",
  "IMPROVEMENT",
];

export const TINKER_RIDER_ID_SET: ReadonlySet<TinkerRiderId> = new Set(TINKER_RIDER_IDS);

const TINKER_CARD_TYPE_LABEL_EN: Record<TinkerCardType, string> = {
  ATTACK: "Attack",
  SKILL: "Skill",
  POWER: "Power",
};

export const TINKER_RIDER_CHOICE_LABELS: Record<TinkerRiderId, string> = {
  SAPPING: "탈력",
  VIOLENCE: "폭력",
  CHOKING: "질식",
  ENERGIZED: "충전",
  WISDOM: "지혜",
  CHAOS: "혼돈",
  EXPERTISE: "전문성",
  CURIOUS: "호기심",
  IMPROVEMENT: "개선",
};

export const TINKER_RIDER_CHOICE_LABELS_EN: Record<TinkerRiderId, string> = {
  SAPPING: "Sapping",
  VIOLENCE: "Violence",
  CHOKING: "Choking",
  ENERGIZED: "Energized",
  WISDOM: "Wisdom",
  CHAOS: "Chaos",
  EXPERTISE: "Expertise",
  CURIOUS: "Curious",
  IMPROVEMENT: "Improvement",
};

export const TINKER_TIME_TITLE_KEY = "TINKER_TIME.title";
export const TINKER_TIME_TITLE_FALLBACK_KO = "땜질 시간";
export const TINKER_TIME_TITLE_FALLBACK_EN = "Tinker Time";

export const TINKER_CARD_TYPE_TO_KO: Record<TinkerCardType, CardTypeKo> = {
  ATTACK: "공격",
  SKILL: "스킬",
  POWER: "파워",
};

export const TINKER_CARD_IMAGE_BY_TYPE: Record<TinkerCardType, string> = {
  ATTACK: "/images/sts2/cards/mad_science_attack.webp",
  SKILL: "/images/sts2/cards/mad_science_skill.webp",
  POWER: "/images/sts2/cards/mad_science_power.webp",
};

export const MAD_SCIENCE_DEFAULT_TYPE: TinkerCardType = "SKILL";
export const MAD_SCIENCE_DEFAULT_RIDER: TinkerRiderId = "CHAOS";
export const MAD_SCIENCE_DEFAULT_IMAGE_URL = TINKER_CARD_IMAGE_BY_TYPE[MAD_SCIENCE_DEFAULT_TYPE];

function formatVariantName(baseName: string, variantLabel: string): string {
  const separator = /[\x00-\x7F]$/.test(baseName) ? " " : "";
  return `${baseName}${separator}(${variantLabel})`;
}

export function getMadScienceRenderedCardName(card: Pick<CodexCard, "id" | "name">): string {
  if (!isMadScienceCardId(card.id)) return card.name;
  return card.name.replace(/\s*\([^)]*\)\s*$/, "");
}

export const TINKER_DYNAMIC_TEXT_VALUES: Record<string, string> = {
  Block: "8",
  ChokingDamage: "6",
  CuriousReduction: "1",
  Damage: "12",
  EnergizedEnergy: "[energy:2]",
  ExpertiseDexterity: "2",
  ExpertiseStrength: "2",
  SappingVulnerable: "2",
  SappingWeak: "2",
  ViolenceHits: "3",
  WisdomCards: "3",
  energyPrefix: "[energy:1]",
};

const MAD_SCIENCE_DYNAMIC_VARS: Record<string, number> = {
  Block: 8,
  ChokingDamage: 6,
  CuriousReduction: 1,
  Damage: 12,
  EnergizedEnergy: 2,
  ExpertiseDexterity: 2,
  ExpertiseStrength: 2,
  SappingVulnerable: 2,
  SappingWeak: 2,
  ViolenceHits: 3,
  WisdomCards: 3,
};

const TINKER_CARD_TYPE_SMART_VALUE: Record<TinkerCardType, string> = {
  ATTACK: "Attack",
  SKILL: "Skill",
  POWER: "Power",
};

const TINKER_RIDER_SMART_VALUE: Record<TinkerRiderId, string> = {
  SAPPING: "Sapping",
  VIOLENCE: "Violence",
  CHOKING: "Choking",
  ENERGIZED: "Energized",
  WISDOM: "Wisdom",
  CHAOS: "Chaos",
  EXPERTISE: "Expertise",
  CURIOUS: "Curious",
  IMPROVEMENT: "Improvement",
};

export function isTinkerCardTypeId(value: string): value is TinkerCardType {
  return TINKER_CARD_TYPE_IDS.has(value as TinkerCardType);
}

export function isTinkerRiderId(value: string): value is TinkerRiderId {
  return TINKER_RIDER_ID_SET.has(value as TinkerRiderId);
}

export function getMadScienceVariantId(
  cardType: TinkerCardType,
  riderId?: TinkerRiderId | null,
): string {
  const typeId = MAD_SCIENCE_CARD_ID_BY_TYPE[cardType];
  return riderId ? `${typeId}_${riderId}` : typeId;
}

export function getTinkerCardTypeFromRunValue(value: number | undefined): TinkerCardType | null {
  if (typeof value !== "number") return null;
  return TINKER_CARD_TYPES[value - 1] ?? TINKER_CARD_TYPES[value] ?? null;
}

export function getTinkerRiderFromRunValue(value: number | undefined): TinkerRiderId | null {
  if (typeof value !== "number") return null;
  return TINKER_RIDER_IDS[value - 1] ?? TINKER_RIDER_IDS[value] ?? null;
}

export function getMadScienceVariantPartsFromId(
  id: string,
): { cardType: TinkerCardType; riderId: TinkerRiderId | null } | null {
  const normalized = id.replace(/^CARD\./i, "").toUpperCase();
  if (normalized === MAD_SCIENCE_CARD_ID) {
    return { cardType: MAD_SCIENCE_DEFAULT_TYPE, riderId: null };
  }
  for (const cardType of TINKER_CARD_TYPES) {
    const typeId = MAD_SCIENCE_CARD_ID_BY_TYPE[cardType];
    if (normalized === typeId) return { cardType, riderId: null };
    for (const riderId of TINKER_RIDER_IDS_BY_TYPE[cardType]) {
      if (normalized === getMadScienceVariantId(cardType, riderId)) {
        return { cardType, riderId };
      }
    }
  }
  return null;
}

export interface MadScienceVariant {
  cardType: TinkerCardType;
  riderId: TinkerRiderId;
}

/** Search param that picks a Mad Science variant: `variant=attack_violence` (or `attack` for the type's default rider). */
export const MAD_SCIENCE_VARIANT_PARAM = "variant";

export const MAD_SCIENCE_DEFAULT_VARIANT: MadScienceVariant = {
  cardType: MAD_SCIENCE_DEFAULT_TYPE,
  riderId: MAD_SCIENCE_DEFAULT_RIDER,
};

export function resolveMadScienceVariant(
  cardType: TinkerCardType,
  riderId?: TinkerRiderId | null,
): MadScienceVariant {
  const riders: readonly TinkerRiderId[] = TINKER_RIDER_IDS_BY_TYPE[cardType];
  return {
    cardType,
    riderId: riderId && riders.includes(riderId) ? riderId : getDefaultTinkerRiderForType(cardType),
  };
}

/** Any Mad Science id (MAD_SCIENCE, the old per-type ids, run ids with a rider) as a full variant. */
export function getMadScienceVariantFromId(id: string): MadScienceVariant | null {
  const parts = getMadScienceVariantPartsFromId(id);
  return parts ? resolveMadScienceVariant(parts.cardType, parts.riderId) : null;
}

export function formatMadScienceVariantParam(variant: MadScienceVariant): string {
  return `${variant.cardType}_${variant.riderId}`.toLowerCase();
}

export function parseMadScienceVariantParam(value: string | null | undefined): MadScienceVariant | null {
  return value ? getMadScienceVariantFromId(`${MAD_SCIENCE_CARD_ID}_${value}`) : null;
}

function isDefaultMadScienceVariant(variant: MadScienceVariant): boolean {
  return variant.cardType === MAD_SCIENCE_DEFAULT_TYPE && variant.riderId === MAD_SCIENCE_DEFAULT_RIDER;
}

/** Card id stored for one variant (toybox posts, mentions): MAD_SCIENCE for the default, else MAD_SCIENCE_ATTACK_VIOLENCE. */
export function getMadScienceVariantCardId(variant: MadScienceVariant): string {
  return isDefaultMadScienceVariant(variant)
    ? MAD_SCIENCE_CARD_ID
    : getMadScienceVariantId(variant.cardType, variant.riderId);
}

/** Codex href for one Mad Science variant; the default variant keeps the bare card URL. */
export function getMadScienceVariantHref(baseHref: string, variant: MadScienceVariant): string {
  if (isDefaultMadScienceVariant(variant)) return baseHref;
  const param = formatMadScienceVariantParam(variant);
  const [path, hash = ""] = baseHref.split("#");
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${MAD_SCIENCE_VARIANT_PARAM}=${param}${hash ? `#${hash}` : ""}`;
}

const TINKER_RIDER_OPTION_RE = new RegExp(
  `(${TINKER_RIDER_IDS.flatMap((riderId) => [
    TINKER_RIDER_CHOICE_LABELS[riderId],
    TINKER_RIDER_CHOICE_LABELS_EN[riderId],
  ]).join("|")})\\s*(?:선택지|옵션|option)`,
  "i",
);

/**
 * Patch notes name the card plainly ("Mad Science"); the Tinker Time option the same line names
 * ("폭력 선택지", "Chaos option") picks the variant. Without one, the default (Skill, Chaos) stands.
 */
export function getMadScienceVariantFromText(text: string): MadScienceVariant {
  const label = text.match(TINKER_RIDER_OPTION_RE)?.[1].toLowerCase();
  const riderId = label
    ? TINKER_RIDER_IDS.find((id) =>
      TINKER_RIDER_CHOICE_LABELS[id] === label || TINKER_RIDER_CHOICE_LABELS_EN[id].toLowerCase() === label)
    : undefined;
  if (!riderId) return MAD_SCIENCE_DEFAULT_VARIANT;
  const cardType = TINKER_CARD_TYPES.find((type) =>
    (TINKER_RIDER_IDS_BY_TYPE[type] as readonly TinkerRiderId[]).includes(riderId))!;
  return { cardType, riderId };
}

export function getTinkerRiderChoiceKey(riderId: TinkerRiderId): string {
  return `TINKER_TIME.pages.CHOOSE_RIDER.options.${riderId}.title`;
}

export function getTinkerRiderDescriptionKey(riderId: TinkerRiderId): string {
  return `TINKER_TIME.pages.CHOOSE_RIDER.options.${riderId}.description`;
}

export function getMadScienceCardTypeFromId(id: string): TinkerCardType | null {
  return getMadScienceVariantPartsFromId(id)?.cardType ?? null;
}

export function isMadScienceCardId(id: string): boolean {
  return getMadScienceCardTypeFromId(id) !== null;
}

export function getTinkerRiderIdsForType(cardType: TinkerCardType): readonly TinkerRiderId[] {
  return TINKER_RIDER_IDS_BY_TYPE[cardType];
}

export function getDefaultTinkerRiderForType(cardType: TinkerCardType): TinkerRiderId {
  if (cardType === "ATTACK") return "VIOLENCE";
  if (cardType === "SKILL") return "CHAOS";
  return TINKER_RIDER_IDS_BY_TYPE[cardType][0];
}

export function replaceTinkerTemplateValues(
  text: string,
  values: Record<string, string> = TINKER_DYNAMIC_TEXT_VALUES,
): string {
  return text
    .replace(/\[([A-Za-z]\w*)\]/g, (match, key: string) => values[key] ?? match)
    .replace(/\{([A-Za-z]\w*)(?::[^}]*)?\}/g, (match, key: string) => values[key] ?? match);
}

function findMatchingBrace(input: string, start: number): number {
  let depth = 0;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevelBranches(input: string): string[] {
  const branches: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "|" && depth === 0) {
      branches.push(input.slice(last, i));
      last = i + 1;
    }
  }
  branches.push(input.slice(last));
  return branches;
}

function isSelectedTinkerFlag(name: string, riderId: TinkerRiderId | null): boolean {
  if (name === "HasRider") return riderId !== null;
  if (!riderId) return false;
  return TINKER_RIDER_SMART_VALUE[riderId] === name;
}

function renderMadScienceBody(
  body: string,
  cardType: TinkerCardType,
  riderId: TinkerRiderId | null,
): string {
  const chooseMatch = body.match(/^(\w+):choose\(([^)]+)\):([\s\S]*)$/);
  if (chooseMatch) {
    const [, name, expectedRaw, rest] = chooseMatch;
    const expectedValues = splitTopLevelBranches(expectedRaw);
    const branches = splitTopLevelBranches(rest);
    const selectedValue = name === "CardType" ? TINKER_CARD_TYPE_SMART_VALUE[cardType] : null;
    const selectedIndex = selectedValue ? expectedValues.indexOf(selectedValue) : -1;
    const fallbackIndex = Math.max(0, Math.min(branches.length - 1, expectedValues.length));
    const branch = selectedIndex >= 0
      ? branches[selectedIndex] ?? ""
      : branches[fallbackIndex] ?? branches[branches.length - 1] ?? "";
    return renderMadScienceConditionals(branch, cardType, riderId);
  }

  const branchMatch = body.match(/^(\w+):([\s\S]*\|[\s\S]*)$/);
  if (branchMatch) {
    const [, name, rest] = branchMatch;
    const branches = splitTopLevelBranches(rest);
    const branch = isSelectedTinkerFlag(name, riderId)
      ? branches[0] ?? ""
      : branches[1] ?? "";
    return renderMadScienceConditionals(branch, cardType, riderId);
  }

  return `{${body}}`;
}

function renderMadScienceConditionals(
  input: string,
  cardType: TinkerCardType,
  riderId: TinkerRiderId | null,
): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] === "{") {
      const end = findMatchingBrace(input, i);
      if (end === -1) {
        out += input.slice(i);
        break;
      }
      const body = input.slice(i + 1, end);
      out += renderMadScienceBody(body, cardType, riderId);
      i = end + 1;
    } else {
      out += input[i];
      i++;
    }
  }
  return out;
}

export function getMadScienceDescriptionRaw(
  card: Pick<CodexCard, "descriptionRaw" | "madScienceBaseDescriptionRaw">,
  cardType: TinkerCardType,
  riderId: TinkerRiderId,
): string {
  const templateRaw = card.madScienceBaseDescriptionRaw ?? card.descriptionRaw;
  return renderMadScienceConditionals(templateRaw, cardType, riderId)
    .replace(/\{energyPrefix:energyIcons\(1\)\}/g, "[energy:1]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getMadSciencePreviewCard(
  card: CodexCard,
  cardType: TinkerCardType,
  riderId: TinkerRiderId,
  typeLabel: string,
): CodexCard {
  const madScienceBaseDescriptionRaw = card.madScienceBaseDescriptionRaw ?? card.descriptionRaw;
  const descriptionRaw = getMadScienceDescriptionRaw(card, cardType, riderId);
  const vars = {
    ...card.vars,
    ...MAD_SCIENCE_DYNAMIC_VARS,
  };

  return {
    ...card,
    block: cardType === "SKILL" ? MAD_SCIENCE_DYNAMIC_VARS.Block : null,
    damage: cardType === "ATTACK" ? MAD_SCIENCE_DYNAMIC_VARS.Damage : null,
    description: bakeDescription(descriptionRaw, vars),
    descriptionRaw,
    hitCount: riderId === "VIOLENCE" ? MAD_SCIENCE_DYNAMIC_VARS.ViolenceHits : null,
    imageUrl: TINKER_CARD_IMAGE_BY_TYPE[cardType],
    madScienceBaseDescriptionRaw,
    name: formatVariantName(card.name, typeLabel),
    nameEn: formatVariantName(card.nameEn, TINKER_CARD_TYPE_LABEL_EN[cardType]),
    type: TINKER_CARD_TYPE_TO_KO[cardType],
    typeLabel,
    vars,
  };
}

/** The one Mad Science card painted as a variant; it keeps the game's card name. */
export function getMadScienceVariantCard(card: CodexCard, variant: MadScienceVariant): CodexCard {
  const typeLabel = card.madScienceLabels?.typeLabels?.[variant.cardType]
    ?? TINKER_CARD_TYPE_TO_KO[variant.cardType];
  return {
    ...getMadSciencePreviewCard(card, variant.cardType, variant.riderId, typeLabel),
    name: card.name,
    nameEn: card.nameEn,
    madScienceVariant: variant,
  };
}

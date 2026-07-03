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

export const TINKER_CARD_TYPE_CHOICE_LABELS: Record<TinkerCardType, string> = {
  ATTACK: "무기",
  SKILL: "보호대",
  POWER: "도구",
};

export const TINKER_CARD_TYPE_CHOICE_LABELS_EN: Record<TinkerCardType, string> = {
  ATTACK: "Weapon",
  SKILL: "Protector",
  POWER: "Gadget",
};

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

export function getTinkerCardTypeChoiceKey(cardType: TinkerCardType): string {
  return `TINKER_TIME.pages.CHOOSE_CARD_TYPE.options.${cardType}.title`;
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

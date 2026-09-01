import {
  getBestiaryDisplayMonsterType,
  isPublicBestiaryMonster,
} from "@/lib/bestiary-monster-policy";
import type {
  AncientSceneAsset,
  CodexAncient,
  CodexCharacter,
  CodexMonster,
  MonsterSpineAsset,
} from "@/lib/codex-types";
import { CHARACTER_ORDER } from "@/lib/codex-types";

export const PALETTE_KINDS = ["character", "boss", "elite", "ancient"] as const;

export type PaletteKind = (typeof PALETTE_KINDS)[number];

export type PaletteSubject = {
  kind: PaletteKind;
  id: string;
  name: string;
  tokenUrl: string | null;
  pickerImageUrl: string | null;
  fallbackImageUrl: string | null;
  spineAsset: MonsterSpineAsset | null;
  actionIds: string[];
};

export type PaletteCharacterSource = Pick<
  CodexCharacter,
  "id" | "name" | "iconUrl" | "combatImageUrl" | "spineAsset"
>;

export type PaletteMonsterSource = Pick<
  CodexMonster,
  "id" | "name" | "type" | "showInCompendium" | "imageUrl" | "bossImageUrl" | "spineAsset"
>;

export type PaletteAncientSource = Pick<CodexAncient, "id" | "name" | "imageUrl" | "spineAsset"> & {
  sceneAsset: Pick<AncientSceneAsset, "token" | "fallback">;
};

export const PALETTE_KIND_COPY: Record<
  PaletteKind,
  { title: string; tokenHeading: string; tokenHint: string; emptySpine: string }
> = {
  character: {
    title: "캐릭터",
    tokenHeading: "얼굴 토큰",
    tokenHint: "원본 / 배색. 클릭하면 Spine이 바뀐다.",
    emptySpine: "이 캐릭터는 추출된 스파인이 없습니다.",
  },
  boss: {
    title: "보스",
    tokenHeading: "보스 토큰",
    tokenHint: "토큰이 있으면 원본 / 배색. 없으면 초상만 고르기용이다.",
    emptySpine: "이 보스는 추출된 스파인이 없습니다.",
  },
  elite: {
    title: "엘리트",
    tokenHeading: "초상",
    tokenHint: "엘리트는 게임 토큰이 없다. 초상은 고르기용이며 배색하지 않는다.",
    emptySpine: "이 엘리트는 추출된 스파인이 없습니다.",
  },
  ancient: {
    title: "고대의 존재",
    tokenHeading: "토큰",
    tokenHint: "원본 / 배색. 스파인은 니오우·테즈카타라만 추출되어 있다.",
    emptySpine: "이 고대의 존재는 추출된 스파인이 없습니다.",
  },
};

const CHARACTER_ACTIONS = ["IDLE", "ATTACK", "HURT"] as const;

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function paletteActionIds(
  kind: PaletteKind,
  spineAsset: MonsterSpineAsset | null,
): string[] {
  if (!spineAsset) return [];
  if (kind === "character") {
    return CHARACTER_ACTIONS.filter((id) => Boolean(spineAsset.moveAnimations[id]?.length));
  }
  return uniqueIds([
    "IDLE",
    ...spineAsset.bestiaryAnimations,
    ...Object.keys(spineAsset.moveAnimations),
  ]).slice(0, 8);
}

export function paletteActionLabel(actionId: string): string {
  if (actionId === "IDLE") return "대기";
  if (actionId === "ATTACK") return "공격";
  if (actionId === "HURT") return "피격";
  return actionId.replaceAll("_", " ");
}

function compareName(left: PaletteSubject, right: PaletteSubject): number {
  return left.name.localeCompare(right.name, "ko");
}

function mapCharacter(character: PaletteCharacterSource): PaletteSubject {
  return {
    kind: "character",
    id: character.id,
    name: character.name,
    tokenUrl: character.iconUrl,
    pickerImageUrl: character.iconUrl,
    fallbackImageUrl: character.combatImageUrl,
    spineAsset: character.spineAsset,
    actionIds: paletteActionIds("character", character.spineAsset),
  };
}

function mapMonster(monster: PaletteMonsterSource, kind: "boss" | "elite"): PaletteSubject | null {
  const tokenUrl = kind === "boss" ? monster.bossImageUrl : null;
  const pickerImageUrl = tokenUrl ?? monster.imageUrl;
  if (!pickerImageUrl && !monster.spineAsset) return null;
  return {
    kind,
    id: monster.id,
    name: monster.name,
    tokenUrl,
    pickerImageUrl,
    fallbackImageUrl: monster.imageUrl,
    spineAsset: monster.spineAsset,
    actionIds: paletteActionIds(kind, monster.spineAsset),
  };
}

function mapAncient(ancient: PaletteAncientSource): PaletteSubject {
  const tokenUrl = ancient.imageUrl ?? ancient.sceneAsset.token;
  return {
    kind: "ancient",
    id: ancient.id,
    name: ancient.name,
    tokenUrl,
    pickerImageUrl: tokenUrl,
    fallbackImageUrl: ancient.sceneAsset.fallback.path,
    spineAsset: ancient.spineAsset,
    actionIds: paletteActionIds("ancient", ancient.spineAsset),
  };
}

export function buildPaletteSubjects(input: {
  characters: readonly PaletteCharacterSource[];
  monsters: readonly PaletteMonsterSource[];
  ancients: readonly PaletteAncientSource[];
}): PaletteSubject[] {
  const characters = [...input.characters]
    .sort((left, right) => CHARACTER_ORDER.indexOf(left.id) - CHARACTER_ORDER.indexOf(right.id))
    .map(mapCharacter);

  const bosses: PaletteSubject[] = [];
  const elites: PaletteSubject[] = [];
  for (const monster of input.monsters) {
    if (!monster.showInCompendium || !isPublicBestiaryMonster(monster.id)) continue;
    const displayType = getBestiaryDisplayMonsterType(monster.id, monster.type);
    if (displayType !== "Boss" && displayType !== "Elite") continue;
    const subject = mapMonster(monster, displayType === "Boss" ? "boss" : "elite");
    if (!subject) continue;
    if (subject.kind === "boss") bosses.push(subject);
    else elites.push(subject);
  }
  bosses.sort(compareName);
  elites.sort(compareName);

  const ancients = input.ancients.map(mapAncient);
  return [...characters, ...bosses, ...elites, ...ancients];
}

export function subjectsForKind(
  subjects: readonly PaletteSubject[],
  kind: PaletteKind,
): PaletteSubject[] {
  return subjects.filter((subject) => subject.kind === kind);
}

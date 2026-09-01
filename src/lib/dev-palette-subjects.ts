import {
  getBestiaryDisplayMonsterType,
  isPublicBestiaryMonster,
} from "@/lib/bestiary-monster-policy";
import type {
  AncientSceneAsset,
  CodexAncient,
  CodexCharacter,
  CodexEncounter,
  CodexMonster,
  MonsterSpineAsset,
} from "@/lib/codex-types";
import { CHARACTER_ORDER } from "@/lib/codex-types";
import { getEncounterMonsterIds } from "@/lib/encounter-compositions";

export const PALETTE_KINDS = ["character", "boss", "elite", "ancient"] as const;

export type PaletteKind = (typeof PALETTE_KINDS)[number];

export type PaletteSpinePreview = "monster" | "encounter" | "static";

export type PaletteSubject = {
  kind: PaletteKind;
  id: string;
  name: string;
  tokenUrl: string | null;
  pickerImageUrl: string | null;
  fallbackImageUrl: string | null;
  spineAsset: MonsterSpineAsset | null;
  actionIds: string[];
  encounterId: string | null;
  spinePreview: PaletteSpinePreview;
  staticPreviewUrl: string | null;
};

export type PaletteCharacterSource = Pick<
  CodexCharacter,
  "id" | "name" | "iconUrl" | "combatImageUrl" | "spineAsset"
>;

export type PaletteMonsterSource = Pick<
  CodexMonster,
  "id" | "name" | "type" | "showInCompendium" | "imageUrl" | "bossImageUrl" | "spineAsset"
>;

export type PaletteEncounterSource = Pick<
  CodexEncounter,
  "id" | "name" | "roomType" | "imageUrl" | "monsters" | "compositions"
> & {
  scene: Pick<NonNullable<CodexEncounter["scene"]>, "backgroundSpineAsset"> | null;
};

export type PaletteAncientSource = Pick<CodexAncient, "id" | "name" | "imageUrl" | "spineAsset"> & {
  sceneAsset: Pick<AncientSceneAsset, "token" | "fallback">;
};

export const PALETTE_KIND_COPY: Record<
  PaletteKind,
  { title: string; tokenHeading: string; tokenHint: string }
> = {
  character: {
    title: "캐릭터",
    tokenHeading: "얼굴 토큰",
    tokenHint: "원본 / 배색. 클릭하면 아래 닉네임 자리 아이콘이 바뀐다.",
  },
  boss: {
    title: "보스",
    tokenHeading: "보스 토큰",
    tokenHint: "보스 전투 토큰 원본 / 배색. 닉네임 앞 아이콘으로 쓴다.",
  },
  elite: {
    title: "엘리트",
    tokenHeading: "초상",
    tokenHint: "엘리트는 게임 토큰이 없다. 초상은 고르기용이며 닉네임 아이콘으로 쓰지 않는다.",
  },
  ancient: {
    title: "고대의 존재",
    tokenHeading: "토큰",
    tokenHint: "원본 / 배색. 클릭하면 아래 닉네임 자리 아이콘이 바뀐다.",
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

export function bossEncounterTokenUrl(encounterId: string): string {
  return `/images/sts2/bosses/${encounterId.toLowerCase()}.webp`;
}

function compareName(left: PaletteSubject, right: PaletteSubject): number {
  return left.name.localeCompare(right.name, "ko");
}

function monsterPreviewFields(
  kind: PaletteKind,
  spineAsset: MonsterSpineAsset | null,
): Pick<PaletteSubject, "actionIds" | "encounterId" | "spinePreview" | "staticPreviewUrl"> {
  return {
    actionIds: paletteActionIds(kind, spineAsset),
    encounterId: null,
    spinePreview: "monster",
    staticPreviewUrl: null,
  };
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
    ...monsterPreviewFields("character", character.spineAsset),
  };
}

function mapElite(monster: PaletteMonsterSource): PaletteSubject | null {
  const pickerImageUrl = monster.imageUrl;
  if (!pickerImageUrl && !monster.spineAsset) return null;
  return {
    kind: "elite",
    id: monster.id,
    name: monster.name,
    tokenUrl: null,
    pickerImageUrl,
    fallbackImageUrl: monster.imageUrl,
    spineAsset: monster.spineAsset,
    ...monsterPreviewFields("elite", monster.spineAsset),
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
    ...monsterPreviewFields("ancient", ancient.spineAsset),
  };
}

function resolveBossSpinePreview(
  encounter: PaletteEncounterSource,
  parts: readonly PaletteMonsterSource[],
): Pick<PaletteSubject, "spinePreview" | "spineAsset" | "actionIds"> {
  const crusher = parts.find((part) => part.id === "CRUSHER");
  const hasKaiserActor = encounter.id === "KAISER_CRAB_BOSS" && Boolean(crusher?.spineAsset);
  const hasBackgroundSpine = Boolean(encounter.scene?.backgroundSpineAsset);
  const spineParts = parts.filter((part) => part.spineAsset);
  if (!hasKaiserActor && !hasBackgroundSpine && spineParts.length === 0) {
    return { spinePreview: "static", spineAsset: null, actionIds: [] };
  }
  return {
    spinePreview: "encounter",
    spineAsset: spineParts[0]?.spineAsset ?? crusher?.spineAsset ?? null,
    actionIds: uniqueIds(
      spineParts.flatMap((part) => paletteActionIds("boss", part.spineAsset)),
    ).slice(0, 8),
  };
}

function mapBossEncounter(
  encounter: PaletteEncounterSource,
  monsterById: Map<string, PaletteMonsterSource>,
): PaletteSubject {
  const tokenUrl = bossEncounterTokenUrl(encounter.id);
  const parts = getEncounterMonsterIds(encounter)
    .map((id) => monsterById.get(id))
    .filter((part): part is PaletteMonsterSource => Boolean(part));
  const preview = resolveBossSpinePreview(encounter, parts);
  const fallbackImageUrl =
    parts.find((part) => part.imageUrl)?.imageUrl
    ?? encounter.imageUrl
    ?? tokenUrl;
  return {
    kind: "boss",
    id: encounter.id,
    name: encounter.name,
    tokenUrl,
    pickerImageUrl: tokenUrl,
    fallbackImageUrl,
    spineAsset: preview.spineAsset,
    actionIds: preview.actionIds,
    encounterId: encounter.id,
    spinePreview: preview.spinePreview,
    staticPreviewUrl: preview.spinePreview === "static" ? tokenUrl : null,
  };
}

export function buildPaletteSubjects(input: {
  characters: readonly PaletteCharacterSource[];
  monsters: readonly PaletteMonsterSource[];
  ancients: readonly PaletteAncientSource[];
  encounters?: readonly PaletteEncounterSource[];
}): PaletteSubject[] {
  const characters = [...input.characters]
    .sort((left, right) => CHARACTER_ORDER.indexOf(left.id) - CHARACTER_ORDER.indexOf(right.id))
    .map(mapCharacter);

  const monsterById = new Map(input.monsters.map((monster) => [monster.id, monster]));
  const bosses = (input.encounters ?? [])
    .filter((encounter) => encounter.roomType === "Boss")
    .map((encounter) => mapBossEncounter(encounter, monsterById))
    .sort(compareName);

  const elites: PaletteSubject[] = [];
  for (const monster of input.monsters) {
    if (!monster.showInCompendium || !isPublicBestiaryMonster(monster.id)) continue;
    if (getBestiaryDisplayMonsterType(monster.id, monster.type) !== "Elite") continue;
    const subject = mapElite(monster);
    if (subject) elites.push(subject);
  }
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

/** Compact nickname-row icon. Elites have no game token; do not remap portraits. */
export function paletteNicknameIconUrl(
  subject: Pick<PaletteSubject, "kind" | "tokenUrl" | "pickerImageUrl">,
): string | null {
  if (subject.tokenUrl) return subject.tokenUrl;
  if (subject.kind === "elite") return null;
  return subject.pickerImageUrl;
}

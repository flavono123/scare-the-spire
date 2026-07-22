import type { EntityInfo } from "@/components/patch-note-renderer";
import type {
  STS2Patch,
  STS2PatchLine,
  Story,
  StoryEntityType,
} from "@/lib/types";

export const RESOURCE_PATCH_INDEX_ASSET = "/generated/sts2-resource-patch-index.json";

export const RESOURCE_PATCH_GROUP_ORDER: StoryEntityType[] = [
  "character",
  "card",
  "relic",
  "potion",
  "power",
  "enchantment",
  "affliction",
  "event",
  "monster",
  "encounter",
  "ancient",
  "epoch",
];

export const RESOURCE_PATCH_GROUP_LABELS: Record<StoryEntityType, {
  ko: string;
  en: string;
}> = {
  character: { ko: "캐릭터", en: "Characters" },
  card: { ko: "카드", en: "Cards" },
  relic: { ko: "유물", en: "Relics" },
  potion: { ko: "포션", en: "Potions" },
  power: { ko: "파워", en: "Powers" },
  enchantment: { ko: "인챈트", en: "Enchantments" },
  affliction: { ko: "고통", en: "Afflictions" },
  event: { ko: "이벤트", en: "Events" },
  monster: { ko: "몬스터", en: "Monsters" },
  encounter: { ko: "인카운터", en: "Encounters" },
  ancient: { ko: "고대의 존재", en: "Ancients" },
  epoch: { ko: "역사", en: "Epochs" },
};

export interface ResourcePatchIndexResource {
  type: StoryEntityType;
  id: string;
  nameKo: string;
  nameEn: string;
  imageUrl: string | null;
  color: string;
  lineIds: string[];
  changeCount: number;
  lastChangedDate: string | null;
  lastChangedPatch: string | null;
}

export interface ResourcePatchIndexGroup {
  type: StoryEntityType;
  labelKo: string;
  labelEn: string;
  resources: ResourcePatchIndexResource[];
}

export interface ResourcePatchIndexData {
  groups: ResourcePatchIndexGroup[];
  lines: Record<string, STS2PatchLine>;
  patches: STS2Patch[];
  staticStories: Story[];
}

const CHARACTER_ORDER = ["IRONCLAD", "SILENT", "REGENT", "NECROBINDER", "DEFECT"];
const RESOURCE_TYPES = new Set<StoryEntityType>(RESOURCE_PATCH_GROUP_ORDER);

function isResourceType(type: EntityInfo["type"] | string): type is StoryEntityType {
  return RESOURCE_TYPES.has(type as StoryEntityType);
}

function resourceKey(type: StoryEntityType, id: string): string {
  return `${type}:${id}`;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\s_-]+/g, "")
    .toLocaleLowerCase();
}

function versionParts(value: string): number[] {
  return value.replace(/^v/, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function comparePatchVersionsDesc(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (b[index] ?? 0) - (a[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function compareLinesDesc(
  left: STS2PatchLine,
  right: STS2PatchLine,
  sourceOrder: ReadonlyMap<string, number>,
): number {
  const dateDiff = right.date.localeCompare(left.date);
  if (dateDiff !== 0) return dateDiff;
  const versionDiff = comparePatchVersionsDesc(left.patch, right.patch);
  if (versionDiff !== 0) return versionDiff;
  return (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0);
}

function characterSectionMatches(line: STS2PatchLine, entity: EntityInfo): boolean {
  const aliases = [entity.id, entity.nameKo, entity.nameEn, ...(entity.aliasesKo ?? []), ...(entity.aliasesEn ?? [])]
    .map(normalizeText)
    .filter(Boolean);
  return line.section.some((section) => {
    const normalizedSection = normalizeText(section);
    return aliases.some((alias) => normalizedSection === alias || normalizedSection.includes(alias));
  });
}

export function buildResourcePatchIndex({
  patchLines,
  patches,
  entities,
  stories,
}: {
  patchLines: STS2PatchLine[];
  patches: STS2Patch[];
  entities: EntityInfo[];
  stories: Story[];
}): ResourcePatchIndexData {
  const sourceOrder = new Map(patchLines.map((line, index) => [line.id, index]));
  const resourceByKey = new Map<string, EntityInfo>();
  const lineIdsByResource = new Map<string, Set<string>>();
  const lineById = new Map(patchLines.map((line) => [line.id, line]));

  for (const entity of entities) {
    if (!isResourceType(entity.type)) continue;
    resourceByKey.set(resourceKey(entity.type, entity.id), entity);
  }

  const addLine = (type: StoryEntityType, id: string, lineId: string) => {
    const key = resourceKey(type, id);
    const existing = lineIdsByResource.get(key) ?? new Set<string>();
    existing.add(lineId);
    lineIdsByResource.set(key, existing);
  };

  for (const line of patchLines) {
    for (const ref of line.entityRefs) {
      if (!isResourceType(ref.type)) continue;
      const key = resourceKey(ref.type, ref.id);
      if (!resourceByKey.has(key)) {
        resourceByKey.set(key, {
          type: ref.type,
          id: ref.id,
          nameKo: ref.label,
          nameEn: ref.label,
          imageUrl: null,
          color: "unknown",
        });
      }
      addLine(ref.type, ref.id, line.id);
    }

    for (const character of entities.filter((entity) => entity.type === "character")) {
      if (characterSectionMatches(line, character)) {
        addLine("character", character.id, line.id);
      }
    }
  }

  const groups = RESOURCE_PATCH_GROUP_ORDER.map((type): ResourcePatchIndexGroup => {
    const resources = [...resourceByKey.values()]
      .filter((entity) => entity.type === type)
      .flatMap((entity): ResourcePatchIndexResource[] => {
        const lineIds = [...(lineIdsByResource.get(resourceKey(type, entity.id)) ?? [])]
          .map((lineId) => lineById.get(lineId))
          .filter((line): line is STS2PatchLine => Boolean(line))
          .sort((left, right) => compareLinesDesc(left, right, sourceOrder))
          .map((line) => line.id);
        if (type !== "character" && lineIds.length === 0) return [];
        const latest = lineIds.length > 0 ? lineById.get(lineIds[0]) : undefined;
        return [{
          type,
          id: entity.id,
          nameKo: entity.nameKo,
          nameEn: entity.nameEn,
          imageUrl: entity.imageUrl,
          color: entity.color,
          lineIds,
          changeCount: lineIds.length,
          lastChangedDate: latest?.date ?? null,
          lastChangedPatch: latest?.patch ?? null,
        }];
      })
      .sort((left, right) => {
        if (type === "character") {
          return CHARACTER_ORDER.indexOf(left.id) - CHARACTER_ORDER.indexOf(right.id);
        }
        const dateDiff = (right.lastChangedDate ?? "").localeCompare(left.lastChangedDate ?? "");
        if (dateDiff !== 0) return dateDiff;
        const versionDiff = comparePatchVersionsDesc(left.lastChangedPatch ?? "", right.lastChangedPatch ?? "");
        if (versionDiff !== 0) return versionDiff;
        return left.nameKo.localeCompare(right.nameKo, "ko");
      });
    const labels = RESOURCE_PATCH_GROUP_LABELS[type];
    return { type, labelKo: labels.ko, labelEn: labels.en, resources };
  }).filter((group) => group.type === "character" || group.resources.length > 0);

  const includedLineIds = new Set(groups.flatMap((group) =>
    group.resources.flatMap((resource) => resource.lineIds),
  ));
  const lines = Object.fromEntries(
    patchLines
      .filter((line) => includedLineIds.has(line.id))
      .map((line) => [line.id, line]),
  );
  const staticStories = stories.filter((story) => story.patchLineId && includedLineIds.has(story.patchLineId));

  return { groups, lines, patches, staticStories };
}

export function findResourcePatchIndexResource(
  data: ResourcePatchIndexData,
  type: StoryEntityType,
  id: string,
): ResourcePatchIndexResource | null {
  return data.groups.find((group) => group.type === type)
    ?.resources.find((resource) => resource.id === id) ?? null;
}

export function resourcePatchLines(
  data: ResourcePatchIndexData,
  resource: ResourcePatchIndexResource,
): STS2PatchLine[] {
  return resource.lineIds.flatMap((lineId) => data.lines[lineId] ? [data.lines[lineId]] : []);
}

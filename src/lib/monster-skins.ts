import type { CodexMonster, MonsterSkinPart, MonsterSkinPartOption, MonsterSpineAsset } from "./codex-types";
import type { ServiceLocale } from "./i18n";

export type MonsterSkinSelections = Record<string, string>;

export function getMonsterSkinParts(asset: MonsterSpineAsset | null | undefined): MonsterSkinPart[] {
  return asset?.skinParts ?? [];
}

export function getDefaultMonsterSkinSelections(monster: CodexMonster): MonsterSkinSelections {
  const selections: MonsterSkinSelections = {};
  for (const part of getMonsterSkinParts(monster.spineAsset)) {
    const firstOption = part.options[0];
    if (firstOption) selections[part.id] = firstOption.id;
  }
  return selections;
}

export function getSelectedMonsterSkinNames(
  monster: CodexMonster,
  selections: MonsterSkinSelections,
): string[] {
  const parts = getMonsterSkinParts(monster.spineAsset);
  if (parts.length === 0) return monster.spineAsset?.defaultSkinCombination ?? [];

  return parts
    .map((part) => selections[part.id] ?? part.options[0]?.id)
    .filter((skinName): skinName is string => Boolean(skinName));
}

export function getSingleMonsterSkin(monster: CodexMonster): string | null {
  return monster.spineAsset?.skin ?? null;
}

export function getMonsterSkinRenderKey(skinNames: string[], singleSkin: string | null): string {
  return skinNames.length > 0 ? skinNames.join("+") : singleSkin ?? "base";
}

export function hasMonsterSkinParts(monster: CodexMonster): boolean {
  return getMonsterSkinParts(monster.spineAsset).length > 0 || (monster.spineAsset?.skinVariants?.length ?? 0) > 1;
}

export function getMonsterSkinPartLabel(part: MonsterSkinPart, serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko" ? part.labelKo : part.labelEn;
}

export function getMonsterSkinOptionLabel(option: MonsterSkinPartOption, serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko" ? option.labelKo : option.labelEn;
}

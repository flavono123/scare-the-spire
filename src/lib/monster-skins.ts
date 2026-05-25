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
  options?: { phobiaMode?: boolean },
): string[] {
  const parts = getMonsterSkinParts(monster.spineAsset);
  if (parts.length === 0) {
    return applyMonsterPhobiaModeSkinNames(
      monster.spineAsset,
      monster.spineAsset?.defaultSkinCombination ?? [],
      options?.phobiaMode ?? false,
    );
  }

  const skinNames = parts
    .map((part) => selections[part.id] ?? part.options[0]?.id)
    .filter((skinName): skinName is string => Boolean(skinName));

  return applyMonsterPhobiaModeSkinNames(monster.spineAsset, skinNames, options?.phobiaMode ?? false);
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

export function hasMonsterPhobiaMode(monster: CodexMonster): boolean {
  return Boolean(monster.spineAsset?.phobiaMode || monster.phobiaModeImageUrl);
}

export function getMonsterPhobiaModeLabel(serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko" ? "공포 완화 모드" : "Phobia Mode";
}

export function getMonsterSkinPartLabel(part: MonsterSkinPart, serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko" ? part.labelKo : part.labelEn;
}

export function getMonsterSkinOptionLabel(option: MonsterSkinPartOption, serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko" ? option.labelKo : option.labelEn;
}

function applyMonsterPhobiaModeSkinNames(
  asset: MonsterSpineAsset | null | undefined,
  skinNames: readonly string[],
  enabled: boolean,
): string[] {
  const phobiaMode = asset?.phobiaMode;
  if (!enabled || !phobiaMode) return [...skinNames];

  const names = skinNames.filter((skinName) => (
    skinName !== phobiaMode.normalSkin && skinName !== phobiaMode.phobiaSkin
  ));
  return [...names, phobiaMode.phobiaSkin];
}

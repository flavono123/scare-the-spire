import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  favoriteTournamentDisplayTitle,
  type FavoriteTournamentPost,
} from "@/lib/favorite-tournament";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

function ancientNamesFromEntityMap(entityMap: Map<string, EntityInfo>): Map<string, string> {
  const names = new Map<string, string>();
  for (const entity of entityMap.values()) {
    if (entity.type === "ancient") names.set(entity.id, entity.nameKo);
  }
  return names;
}

export function worldcupPostTitle(
  post: FavoriteTournamentPost,
  serviceLocale: ServiceLocale,
  presetLabels: Record<string, string>,
  entityMap: Map<string, EntityInfo>,
): string {
  const copy = serviceMessages[serviceLocale];
  return favoriteTournamentDisplayTitle(
    post,
    presetLabels,
    copy.decisionsDecisions,
    ancientNamesFromEntityMap(entityMap),
    copy.codex.monstersView.monsterTypes,
  );
}

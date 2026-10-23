import { assembleCompendiumDetailPayload } from "@/lib/compendium-detail-payload";
import type { CompendiumDetailPayload } from "@/lib/compendium-detail-payload";
import { loadCompendiumDataResources } from "@/lib/compendium-data-chunks.server";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  DEFAULT_SERVICE_LOCALE,
  type ServiceLocale,
} from "@/lib/i18n";

export async function buildCompendiumDetailPayload(
  serviceLocale: ServiceLocale = DEFAULT_SERVICE_LOCALE,
): Promise<CompendiumDetailPayload> {
  const gameLocale = DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale];
  const resources = await loadCompendiumDataResources(gameLocale);
  return assembleCompendiumDetailPayload(serviceLocale, gameLocale, resources);
}

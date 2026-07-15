import { CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-page";
import {
  generateCompendiumDetailSeoSummary,
} from "@/lib/compendium-detail-metadata";
import {
  COMPENDIUM_DETAIL_PAYLOAD_PATH,
  type CompendiumDetailResourceType,
} from "@/lib/compendium-detail-payload";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  DEFAULT_SERVICE_LOCALE,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

type CompendiumDirectDetailRouteProps = {
  resourceType: CompendiumDetailResourceType;
  id: string;
  payloadPath?: string;
  gameLocale?: GameLocale;
  serviceLocale?: ServiceLocale;
};

export async function CompendiumDirectDetailRoute({
  resourceType,
  id,
  payloadPath = COMPENDIUM_DETAIL_PAYLOAD_PATH,
  serviceLocale = DEFAULT_SERVICE_LOCALE,
  gameLocale = DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale],
}: CompendiumDirectDetailRouteProps) {
  const initialSummary = await generateCompendiumDetailSeoSummary(resourceType, id, {
    gameLocale,
    serviceLocale,
  });

  return (
    <CompendiumDirectDetailPage
      resourceType={resourceType}
      id={id}
      payloadPath={payloadPath}
      initialSummary={initialSummary}
    />
  );
}

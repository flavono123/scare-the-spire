import { CompendiumDirectDetailRoute } from "@/components/codex/compendium-direct-detail-route";
import {
  COMPENDIUM_DETAIL_PAYLOAD_PATH_BY_SERVICE_LOCALE,
  type CompendiumDetailResourceType,
} from "@/lib/compendium-detail-payload";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";

type LocalizedCompendiumDirectDetailPageProps = {
  resourceType: CompendiumDetailResourceType;
  id: string;
  gameLocale: GameLocale;
};

export function LocalizedCompendiumDirectDetailPage({
  resourceType,
  id,
  gameLocale,
}: LocalizedCompendiumDirectDetailPageProps) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);

  return (
    <CompendiumDirectDetailRoute
      resourceType={resourceType}
      id={id}
      payloadPath={COMPENDIUM_DETAIL_PAYLOAD_PATH_BY_SERVICE_LOCALE[serviceLocale]}
      gameLocale={gameLocale}
      serviceLocale={serviceLocale}
    />
  );
}

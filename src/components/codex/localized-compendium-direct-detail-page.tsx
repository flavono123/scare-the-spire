import { CompendiumDirectDetailRoute } from "@/components/codex/compendium-direct-detail-route";
import type { CompendiumDetailResourceType } from "@/lib/compendium-detail-payload";
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
  return (
    <CompendiumDirectDetailRoute
      resourceType={resourceType}
      id={id}
      gameLocale={gameLocale}
      serviceLocale={getServiceLocaleForGameLocale(gameLocale)}
    />
  );
}

import { CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-page";
import { CompendiumStaticDetail } from "@/components/codex/compendium-static-detail";
import {
  generateCompendiumDetailSeoSummary,
} from "@/lib/compendium-detail-metadata";
import type { CompendiumDetailResourceType } from "@/lib/compendium-detail-payload";
import { buildCompendiumStaticDetail } from "@/lib/compendium-static-detail";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  DEFAULT_SERVICE_LOCALE,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

type CompendiumDirectDetailRouteProps = {
  resourceType: CompendiumDetailResourceType;
  id: string;
  gameLocale?: GameLocale;
  serviceLocale?: ServiceLocale;
};

export async function CompendiumDirectDetailRoute({
  resourceType,
  id,
  serviceLocale = DEFAULT_SERVICE_LOCALE,
  gameLocale = DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale],
}: CompendiumDirectDetailRouteProps) {
  const [initialSummary, staticDetail] = await Promise.all([
    generateCompendiumDetailSeoSummary(resourceType, id, { gameLocale, serviceLocale }),
    buildCompendiumStaticDetail(resourceType, id, { gameLocale, serviceLocale }),
  ]);

  return (
    <CompendiumDirectDetailPage
      resourceType={resourceType}
      id={id}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
      initialSummary={initialSummary}
      staticContent={staticDetail ? <CompendiumStaticDetail model={staticDetail} /> : undefined}
    />
  );
}

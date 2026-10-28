import { preload } from "react-dom";
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

  // A static detail that shows Korean uses GC Batang's common-character subset
  // with font-display: optional (globals.css, same locale condition), so only
  // if it is ready within ~100ms. Preloading it starts it before the full file
  // the root layout preloads, which takes ~150ms to decode.
  if (staticDetail && (serviceLocale === "ko" || gameLocale === "kor")) {
    preload("/fonts/GyeonggiCheonnyeonBatangBold-common.woff2", {
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous",
    });
  }

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

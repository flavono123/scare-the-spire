import { renderHome } from "@/app/(main)/page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export default async function LocalizedHome({
  params,
}: {
  params: Promise<LocaleRouteParams>;
}) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderHome(gameLocale);
}

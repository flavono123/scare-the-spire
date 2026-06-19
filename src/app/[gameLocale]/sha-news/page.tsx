import { redirect } from "next/navigation";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";
import { localizeHrefWithGameLocale } from "@/lib/i18n";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export default async function LegacyLocalizedShaNewsPage({ params }: Props) {
  const { serviceLocale, gameLocale } = await getLocalePairFromParams(params);
  redirect(localizeHrefWithGameLocale("/byrdispatch", serviceLocale, gameLocale));
}

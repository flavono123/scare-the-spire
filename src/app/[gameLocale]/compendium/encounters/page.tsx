import { redirect } from "next/navigation";
import type { LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export default async function LocalizedCompendiumEncountersRedirect({
  params,
}: Props) {
  const { gameLocale } = await params;
  redirect(`/${gameLocale}/compendium/bestiary?view=encounters`);
}

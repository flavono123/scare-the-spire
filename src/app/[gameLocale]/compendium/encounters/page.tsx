import { redirect } from "next/navigation";
import type { LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LocalizedCompendiumEncountersRedirect({
  params,
  searchParams,
}: Props) {
  const { gameLocale } = await params;
  const query = buildSearchParams(await searchParams, { view: "encounters" });
  redirect(`/${gameLocale}/compendium/bestiary${query}`);
}

function buildSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  extra: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value != null) {
      params.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

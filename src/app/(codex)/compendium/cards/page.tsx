export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../codex/cards/page";
import {
  DEFAULT_ROUTE_GAME_LOCALE,
  searchRecordForGameLocale,
} from "@/lib/locale-routing";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function compendiumCardSearchParams(searchParams: SearchParams) {
  const resolvedSearchParams = await searchParams;
  return {
    ...resolvedSearchParams,
    ...searchRecordForGameLocale(DEFAULT_ROUTE_GAME_LOCALE),
  };
}

export function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  return generateBaseMetadata({
    searchParams: compendiumCardSearchParams(searchParams),
  });
}

export default function CompendiumCardsPage({ searchParams }: { searchParams: SearchParams }) {
  return BasePage({
    searchParams: compendiumCardSearchParams(searchParams),
  });
}

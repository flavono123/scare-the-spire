import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXClient } from "@/components/chemicalx/chemicalx-client";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleForGameLocale,
} from "@/lib/i18n";
import { withPageOgImage } from "@/lib/page-og-images";
import { getChemicalXPlaceholder } from "@/lib/borrowed-game-copy";
import { serviceMessages } from "@/messages/service";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return withPageOgImage({
    title: serviceMessages[serviceLocale].chemicalX.title,
  }, "/chemical-x");
}

export default async function ChemicalXPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const [entities, placeholder] = await Promise.all([
    loadAllEntities({ gameLocale }),
    getChemicalXPlaceholder(gameLocale),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXClient entities={entities} placeholder={placeholder} />
    </div>
  );
}

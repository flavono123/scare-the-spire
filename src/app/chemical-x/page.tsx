import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXClient } from "@/components/chemicalx/chemicalx-client";
import { getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  return {
    title: serviceMessages[serviceLocale].chemicalX.title,
  };
}

export default async function ChemicalXPage() {
  const entities = await loadAllEntities();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXClient entities={entities} />
    </div>
  );
}

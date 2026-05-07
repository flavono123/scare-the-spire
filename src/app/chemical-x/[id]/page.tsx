import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleForGameLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return {
    title: serviceMessages[serviceLocale].chemicalX.title,
  };
}

export default async function ChemicalXPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const entities = await loadAllEntities({ gameLocale });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXPostView postId={id} entities={entities} />
    </div>
  );
}

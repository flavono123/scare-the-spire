import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexPets } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { PetDetailLoader } from "@/components/codex/pet-detail-loader";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const pets = await getCodexPets();
  return pets.map((pet) => ({ id: pet.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const pets = await getCodexPets({ gameLocale });
  const pet = findCodexResourceByRouteId(pets, id);
  if (!pet) return {};
  return getCodexResourceOgMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).pets, pet);
}

export default async function PetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [pets, gameUi] = await Promise.all([
    getCodexPets({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const pet = pets.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!pet) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PetDetailLoader
        gameLocale={gameLocale}
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={getCodexServiceMessages(serviceLocale).pets}
        pet={pet}
      />
    </div>
  );
}

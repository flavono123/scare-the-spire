import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { withPageOgImage } from "@/lib/page-og-images";
import { serviceMessages } from "@/messages/service";

export async function generateChemicalXPostMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return withPageOgImage({
    title: serviceMessages[serviceLocale].chemicalX.title,
  }, "/chemical-x/[id]");
}

export async function generateMetadata(): Promise<Metadata> {
  return generateChemicalXPostMetadata();
}

export async function renderChemicalXPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const entities = await loadAllEntities({ gameLocale });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXPostView postId={id} entities={entities} />
    </div>
  );
}

export default async function ChemicalXPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderChemicalXPostPage(id);
}

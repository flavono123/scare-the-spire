import type { Metadata } from "next";
import { ThisOrThatPostView } from "@/components/this-or-that/post-view";
import { getThisOrThatGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { THIS_OR_THAT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { loadThisOrThatEntities } from "@/lib/this-or-that-data";
import { serviceMessages } from "@/messages/service";

export async function generateThisOrThatPostMetadata(
  _id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getThisOrThatGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: serviceMessages[serviceLocale].thisOrThat.metadata.description,
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return generateThisOrThatPostMetadata(id);
}

export async function renderThisOrThatPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const entities = await loadThisOrThatEntities({ gameLocale });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ThisOrThatPostView
        postId={id}
        entities={entities}
        gameLocale={gameLocale}
      />
    </div>
  );
}

export default async function ThisOrThatPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderThisOrThatPostPage(id);
}

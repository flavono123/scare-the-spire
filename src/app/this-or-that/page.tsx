import type { Metadata } from "next";
import { ThisOrThatClient } from "@/components/this-or-that/this-or-that-client";
import { getThisOrThatGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { loadThisOrThatEntities } from "@/lib/this-or-that-data";
import { serviceMessages } from "@/messages/service";

export async function generateThisOrThatMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getThisOrThatGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: serviceMessages[serviceLocale].thisOrThat.metadata.description,
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return generateThisOrThatMetadata();
}

export async function renderThisOrThatPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [entities, gameCopy] = await Promise.all([
    loadThisOrThatEntities({ gameLocale }),
    getThisOrThatGameCopy(gameLocale),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <ThisOrThatClient
        entities={entities}
        gameLocale={gameLocale}
        title={gameCopy.title}
        prompt={gameCopy.prompt}
      />
    </div>
  );
}

export default async function ThisOrThatPage() {
  return renderThisOrThatPage();
}

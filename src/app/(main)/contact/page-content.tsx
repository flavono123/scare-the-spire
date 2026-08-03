import type { Metadata } from "next";
import { getFeedbackFormGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { readGameLocalizationTable } from "@/lib/game-localization";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { contactMessages } from "@/messages/contact";
import ContactPage from "./contact-page";

export function generateContactMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Metadata {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = contactMessages[serviceLocale];
  return {
    ...copy.metadata,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export async function renderContactPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [feedbackCopy, relicCopy] = await Promise.all([
    getFeedbackFormGameCopy(gameLocale),
    readGameLocalizationTable(gameLocale, "relics"),
  ]);
  const mailboxTitle = relicCopy["TINY_MAILBOX.title"]
    ?? (serviceLocale === "ko" ? "작은 우편함" : "Tiny Mailbox");

  return (
    <ContactPage
      copy={contactMessages[serviceLocale]}
      feedbackCopy={feedbackCopy}
      mailboxTitle={mailboxTitle}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
    />
  );
}

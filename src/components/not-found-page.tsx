"use client";

import { useEffect, useSyncExternalStore } from "react";
import { NotFoundView } from "@/components/not-found-view";
import { getServiceLocaleForGameLocale, gameLocaleFromPathSegment, type ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

const SERVICE_LOCALES: readonly ServiceLocale[] = ["ko", "en"];

function subscribeToNothing(): () => void {
  return () => {};
}

function gameLocalePathPrefix(): string {
  const segment = window.location.pathname.split("/")[1];
  return gameLocaleFromPathSegment(segment) ? `/${segment.toLowerCase()}` : "";
}

/**
 * One prerendered page answers every unknown path, so it holds both service
 * languages and CSS picks one from `<html data-service-locale>`, which the
 * Worker sets. The links get their locale prefix once the page is hydrated.
 */
export function NotFoundPage() {
  const pathPrefix = useSyncExternalStore(subscribeToNothing, gameLocalePathPrefix, () => "");

  useEffect(() => {
    const segment = pathPrefix.slice(1);
    const gameLocale = gameLocaleFromPathSegment(segment);
    const messages = serviceMessages[gameLocale ? getServiceLocaleForGameLocale(gameLocale) : "ko"];
    const title = `${messages.notFound.title} - ${messages.brand}`;
    // Metadata from the shared prerender keeps the Korean title and arrives
    // after this effect, on load and on client navigation alike.
    const applyTitle = () => {
      if (document.title !== title) document.title = title;
    };
    applyTitle();
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathPrefix]);

  return SERVICE_LOCALES.map((serviceLocale) => (
    <div key={serviceLocale} data-service-locale-only={serviceLocale}>
      <NotFoundView serviceLocale={serviceLocale} pathPrefix={pathPrefix} />
    </div>
  ));
}

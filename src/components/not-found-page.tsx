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
    document.title = `${messages.notFound.title} - ${messages.brand}`;
  }, [pathPrefix]);

  return SERVICE_LOCALES.map((serviceLocale) => (
    <div key={serviceLocale} data-service-locale-only={serviceLocale}>
      <NotFoundView serviceLocale={serviceLocale} pathPrefix={pathPrefix} />
    </div>
  ));
}

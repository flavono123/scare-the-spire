"use client";

import { usePathname } from "next/navigation";
import Image from "@/components/ui/static-image";
import { getServiceLocaleFromPath } from "@/lib/i18n";
import { SITE_ORIGIN } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";

const NOTICE_ICON = "/images/sts2/powers/signal_boost_power.webp";

export default function NotFound() {
  const pathname = usePathname();
  const serviceLocale = getServiceLocaleFromPath(pathname ?? "/");
  const copy = serviceMessages[serviceLocale].migrationNotFound;

  return (
    <main
      data-migration-not-found
      className="relative isolate flex min-h-[calc(100svh-3rem)] items-center justify-center overflow-hidden px-4 py-16"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_35%,rgba(244,114,182,0.13),transparent_42%),linear-gradient(180deg,rgba(24,24,35,0.96),rgba(9,9,14,1))]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-pink-300/40 to-transparent"
      />

      <section className="w-full max-w-lg border border-pink-300/30 bg-zinc-950/75 px-6 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_36px_rgba(244,114,182,0.08)] backdrop-blur sm:px-10 sm:py-12">
        <Image
          src={NOTICE_ICON}
          alt=""
          width={80}
          height={80}
          className="mx-auto h-20 w-20 object-contain drop-shadow-[0_0_22px_rgba(244,114,182,0.35)]"
        />
        <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-pink-200">
          404 · {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-balance text-2xl font-black leading-tight text-zinc-50 sm:text-3xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-6 text-zinc-300 sm:text-base">
          {copy.description}
        </p>
        <a
          href={SITE_ORIGIN}
          className="mt-8 inline-flex min-h-11 items-center justify-center border border-amber-300/60 bg-amber-400/15 px-6 py-3 text-sm font-black text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.12)] transition-colors hover:border-amber-200 hover:bg-amber-400/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
        >
          {copy.cta}
        </a>
      </section>
    </main>
  );
}

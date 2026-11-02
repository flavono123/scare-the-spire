import Link from "next/link";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

/** `pathPrefix` is the game locale prefix of the links, such as `/ja`, or empty. */
export function NotFoundView({
  serviceLocale,
  pathPrefix,
}: {
  serviceLocale: ServiceLocale;
  pathPrefix: string;
}) {
  const copy = serviceMessages[serviceLocale].notFound;
  const linkClassName = "rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary/15 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70";

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <Image
        src="/images/sts2/powers/battleworn_dummy_time_limit_power.webp"
        alt=""
        width={64}
        height={64}
        aria-hidden
        className="object-contain opacity-90"
      />
      <p className="text-3xl font-bold text-primary">404</p>
      <h1 className="text-lg font-semibold text-foreground">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link prefetch={false} href={pathPrefix || "/"} className={linkClassName}>
          {copy.home}
        </Link>
        <Link prefetch={false} href={`${pathPrefix}/compendium`} className={linkClassName}>
          {copy.compendium}
        </Link>
      </div>
    </div>
  );
}

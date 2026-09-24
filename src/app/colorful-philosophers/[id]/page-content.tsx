import type { Metadata } from "next";
import { ColorfulPhilosopherPostView } from "@/components/colorful-philosophers/post-view";
import { ServiceBackground } from "@/components/service-background";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { getDebateGameCopy } from "@/lib/borrowed-game-copy";
import { COLORFUL_PHILOSOPHERS_BACKGROUND_SRC, COLORFUL_PHILOSOPHERS_HREF } from "@/lib/colorful-philosophers";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { COLORFUL_PHILOSOPHERS_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxPostOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { metadataRecordId } from "@/lib/static-detail-shell";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateColorfulPhilosopherPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const gameCopy = await getDebateGameCopy(gameLocale);
  const recordId = metadataRecordId(id);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: composeToyBoxPostOgDescription({
      serviceLocale,
      serviceName: gameCopy.title,
      serviceDescription: copy.subtitle,
    }),
    image: COLORFUL_PHILOSOPHERS_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `${COLORFUL_PHILOSOPHERS_HREF}/${recordId}` : COLORFUL_PHILOSOPHERS_HREF,
  });
}

export function renderColorfulPhilosopherPostPage() {
  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src={COLORFUL_PHILOSOPHERS_BACKGROUND_SRC}
        imageClassName="object-[18%_22%] opacity-70 sm:object-[22%_28%]"
      />
      <div className={TOYBOX_NARROW_SHELL_CLASS}>
        <StaticDetailShell>
          <ColorfulPhilosopherPostView postId="" />
        </StaticDetailShell>
      </div>
    </div>
  );
}

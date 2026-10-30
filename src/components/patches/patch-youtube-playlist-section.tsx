import { Youtube } from "lucide-react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { youtubePlaylistEmbedUrl } from "@/lib/youtube-reference";

const SECTION_TITLE: Record<ServiceLocale, string> = {
  ko: "슬서운 이야기 유튜브",
  en: "Scare the Spire YouTube",
};

const CHANNEL_URL = "https://www.youtube.com/@scarethespire";

export function PatchYoutubePlaylistSection({
  playlistId,
  playlistTitle,
  serviceLocale,
}: {
  playlistId: string;
  playlistTitle: string;
  serviceLocale: ServiceLocale;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-game-title text-xl font-bold tracking-wide">
        <a
          href={CHANNEL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 spire-blue transition-colors hover:text-blue-300"
        >
          <Image
            src="/favicon.ico"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 rounded-sm"
          />
          <Youtube aria-hidden="true" className="h-5 w-5 shrink-0 text-red-500" />
          {SECTION_TITLE[serviceLocale]} &rarr;
        </a>
      </h2>
      <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-zinc-700 bg-black">
        <iframe
          src={youtubePlaylistEmbedUrl(playlistId)}
          title={playlistTitle}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </section>
  );
}

import type { ServiceLocale } from "@/lib/i18n";
import { youtubePlaylistEmbedUrl } from "@/lib/youtube-reference";

const SECTION_TITLE: Record<ServiceLocale, string> = {
  ko: "슬서운 이야기 유튜브",
  en: "Scare the Spire YouTube",
};

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
      <h2 className="font-game-title text-xl font-bold tracking-wide text-foreground">
        {SECTION_TITLE[serviceLocale]}
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

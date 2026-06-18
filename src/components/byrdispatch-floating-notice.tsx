import Link from "next/link";
import Image from "@/components/ui/static-image";
import {
  getLatestShaNewsNotice,
  SHA_NEWS_NOTICE_ICON,
} from "@/lib/sha-news";

export async function ByrdispatchFloatingNotice() {
  const notice = await getLatestShaNewsNotice();
  if (!notice) return null;

  return (
    <aside className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-3 sm:bottom-5">
      <Link
        href="/byrdispatch"
        className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2 border border-pink-300/45 bg-pink-500/20 px-3 py-2 text-pink-50 shadow-[0_0_24px_rgba(244,114,182,0.18)] backdrop-blur transition-colors hover:border-pink-200/70 hover:bg-pink-500/25"
        aria-label="섀 소식 공지 보기"
      >
        <Image
          src={SHA_NEWS_NOTICE_ICON}
          alt=""
          width={22}
          height={22}
          className="h-5 w-5 shrink-0 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]"
        />
        <span className="shrink-0 text-xs font-black text-pink-100 sm:text-sm">
          공지:
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">
          {notice.text}
        </span>
        <span className="shrink-0 text-xs font-black text-pink-100 underline decoration-pink-200/45 underline-offset-4">
          섀 소식
        </span>
      </Link>
    </aside>
  );
}

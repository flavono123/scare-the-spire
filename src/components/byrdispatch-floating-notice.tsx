import { ByrdispatchFloatingNoticeClient } from "@/components/byrdispatch-floating-notice-client";
import {
  getLatestShaNewsNotice,
  SHA_NEWS_NOTICE_ICON,
} from "@/lib/sha-news";

export async function ByrdispatchFloatingNotice() {
  const notice = await getLatestShaNewsNotice();
  if (!notice) return null;

  return (
    <ByrdispatchFloatingNoticeClient
      noticeIconSrc={SHA_NEWS_NOTICE_ICON}
      noticeText={notice.text}
    />
  );
}

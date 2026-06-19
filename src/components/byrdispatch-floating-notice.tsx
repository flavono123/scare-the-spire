import { ByrdispatchFloatingNoticeClient } from "@/components/byrdispatch-floating-notice-client";
import { getLatestShaNewsNotice } from "@/lib/sha-news";

export async function ByrdispatchFloatingNotice() {
  const notice = await getLatestShaNewsNotice();
  if (!notice) return null;

  return <ByrdispatchFloatingNoticeClient noticeText={notice.text} />;
}

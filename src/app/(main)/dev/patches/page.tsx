import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";

export const metadata = {
  title: "패치노트 카탈로그 — DEV",
  description: "개발 전용: 패치노트의 모든 타입, 상태, 뱃지, 뷰 쇼케이스",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DevPatchesPage() {
  if (!devToolsEnabled()) {
    notFound();
  }

  const { default: PatchesDevPage } = await import("./patches-dev-page");
  return <PatchesDevPage />;
}

import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";

export const metadata = {
  title: "게임 레퍼런스 — DEV",
  description: "개발 전용: 승천, 모디파이어, 키워드, 고난, 의도, 막 데이터",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ReferencePage() {
  if (!devToolsEnabled()) {
    notFound();
  }

  const { default: ReferenceDevPage } = await import("./reference-dev-page");
  return <ReferenceDevPage />;
}

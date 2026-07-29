import { notFound } from "next/navigation";

export const metadata = {
  title: "첨탑식 아이콘 실험실 — DEV",
  description: "개발 전용: lucide 아이콘을 게임 토큰 애셋과 variant로 대체하는 프리뷰",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function SpireIconsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: SpireIconsDevPage } = await import("./spire-icons-dev-page");
  return <SpireIconsDevPage />;
}

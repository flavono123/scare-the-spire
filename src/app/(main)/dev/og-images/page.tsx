import { notFound } from "next/navigation";

export const metadata = {
  title: "OG 이미지 현황 — DEV",
  description: "개발 전용: 페이지별 OG 이미지 매핑 현황",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OgImagesDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: OgImagesDevDashboard } = await import("./og-images-dev-page");
  return <OgImagesDevDashboard />;
}

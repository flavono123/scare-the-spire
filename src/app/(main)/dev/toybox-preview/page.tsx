import { notFound } from "next/navigation";

export const metadata = {
  title: "장난감 상자 미리보기 — DEV",
  description: "개발 전용: 장난감 상자 인덱스·상세를 PC/모바일 뷰포트로 나란히 본다",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function ToyBoxPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: ToyBoxPreviewDevPage } = await import("./toybox-preview-dev-page");
  return <ToyBoxPreviewDevPage />;
}

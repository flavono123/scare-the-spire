import { notFound } from "next/navigation";

export const metadata = {
  title: "텍스트 효과 레퍼런스 — DEV",
  description: "개발 전용: Spire BBCode 텍스트 효과 카탈로그",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TextEffectsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: TextEffectsDevPage } = await import("./text-effects-dev-page");
  return <TextEffectsDevPage />;
}

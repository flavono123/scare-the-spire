import { notFound } from "next/navigation";

export const metadata = {
  title: "이번 주 토론 대상 — DEV",
  description: "개발 전용: 다채로운 철학자들의 이번 주 백과사전 대상을 지목합니다",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default async function DebateDevRoute() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { DebateDevPage } = await import("./debate-dev-page");
  return <DebateDevPage />;
}

import { notFound } from "next/navigation";

export const metadata = {
  title: "토론 주차 예약 — DEV",
  description: "개발 전용: 다가올 주의 다채로운 철학자 토론 대상을 예약합니다",
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

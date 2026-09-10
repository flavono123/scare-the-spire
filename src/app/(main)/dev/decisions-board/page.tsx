import { notFound } from "next/navigation";

export const metadata = {
  title: "어려운 결정 보드 검수 — DEV",
  description: "개발 전용: 카드·유물·포션·몬스터·혼합 티어 보드를 375/640에서 본다",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function DecisionsBoardLabPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { DecisionsBoardDevPage } = await import("./decisions-board-dev-page");
  return <DecisionsBoardDevPage />;
}

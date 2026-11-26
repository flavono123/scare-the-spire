import { notFound } from "next/navigation";

export const metadata = {
  title: "빈 카드 — DEV",
  description: "개발 전용: 아트와 이름이 빈 카드 타일을 문구와 힌트로 채워 정답 카드를 맞히는 짜퍼 미니 게임 플레이테스트",
  robots: { index: false, follow: false },
};

export default async function DevBlankCardPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const { default: BlankCardDevPage } = await import("./blank-card-dev-page");
    return <BlankCardDevPage cardId={(await searchParams).card} />;
  }
  notFound();
}

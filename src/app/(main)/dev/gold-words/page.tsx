import { notFound } from "next/navigation";

export const metadata = {
  title: "팁 없는 금색 단어 — DEV",
  description: "개발 전용: 게임 문구에서 금색이지만 게임이 호버팁을 붙이지 않는 단어 목록",
  robots: { index: false, follow: false },
};

export default async function DevGoldWordsPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const { default: GoldWordsDevPage } = await import("./gold-words-dev-page");
    return <GoldWordsDevPage locale={(await searchParams).locale ?? "kor"} />;
  }
  notFound();
}

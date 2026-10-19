import { notFound } from "next/navigation";

export const metadata = {
  title: "전투 시뮬레이터 — DEV",
  description: "개발 전용: 버전·캐릭터·조우·손패를 입력받아 전투 장면을 결정적으로 재생하고 쇼츠용으로 캡처한다",
  robots: {
    index: false,
    follow: false,
  },
};

interface CombatSimPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CombatSimPage({ searchParams }: CombatSimPageProps) {
  // NODE_ENV is inlined at build time, so a production build drops this branch
  // and its dynamic import: no engine or scene chunk is emitted. Anything else
  // gets notFound().
  if (process.env.NODE_ENV === "development") {
    const { default: CombatSimDevPage } = await import("./combat-sim-dev-page");
    return <CombatSimDevPage searchParams={await searchParams} />;
  }
  notFound();
}

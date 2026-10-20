import { notFound } from "next/navigation";

export const metadata = {
  title: "맵 진행 바 시뮬레이터 — DEV",
  description: "개발 전용: 노드 열·공개 결과·방향·도착 시각을 입력받아 맵 부품으로 된 진행 바를 결정적으로 재생하고 쇼츠용으로 캡처한다",
  robots: {
    index: false,
    follow: false,
  },
};

interface MapBarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MapBarPage({ searchParams }: MapBarPageProps) {
  // NODE_ENV is inlined at build time, so a production build drops this branch
  // and its dynamic import: no engine or scene chunk is emitted. Anything else
  // gets notFound().
  if (process.env.NODE_ENV === "development") {
    const { default: MapBarDevPage } = await import("./map-bar-dev-page");
    return <MapBarDevPage searchParams={await searchParams} />;
  }
  notFound();
}

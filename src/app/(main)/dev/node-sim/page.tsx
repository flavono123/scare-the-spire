import { notFound } from "next/navigation";

export const metadata = {
  title: "노드 시뮬레이터 — DEV",
  description: "개발 전용: 전투 밖 노드(블리츠 상인 등)를 결정적으로 재생하고 쇼츠용으로 캡처한다",
  robots: {
    index: false,
    follow: false,
  },
};

interface NodeSimPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NodeSimPage({ searchParams }: NodeSimPageProps) {
  // NODE_ENV is inlined at build time, so a production build drops this branch and its
  // dynamic import: no node scene chunk is emitted. Anything else gets notFound().
  if (process.env.NODE_ENV === "development") {
    const { default: NodeSimDevPage } = await import("./node-sim-dev-page");
    return <NodeSimDevPage searchParams={await searchParams} />;
  }
  notFound();
}

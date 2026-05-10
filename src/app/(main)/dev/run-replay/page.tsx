import { notFound } from "next/navigation";

export const metadata = {
  title: "런 리플레이 — DEV",
  description: "개발 전용: STS2 .run 기반 seeded map replay PoC",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RunReplayPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: RunReplayDevPage } = await import("./run-replay-dev-page");
  return <RunReplayDevPage />;
}

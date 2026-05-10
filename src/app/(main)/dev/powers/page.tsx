import { notFound } from "next/navigation";

export const metadata = {
  title: "파워 — DEV",
  description: "DEV — STS2 파워 아이콘/데이터 미리보기",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PowersPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: PowersDevPage } = await import("./powers-dev-page");
  return <PowersDevPage />;
}

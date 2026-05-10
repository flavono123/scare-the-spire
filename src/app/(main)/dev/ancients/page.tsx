import { notFound } from "next/navigation";

export const metadata = {
  title: "고대신 — DEV",
  description: "DEV — 역사 타임라인, 고대 존재/보스/NPC/렌더 에셋 미리보기",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AncientsDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: AncientsDevDashboard } = await import("./ancients-dev-page");
  return <AncientsDevDashboard />;
}

import { notFound } from "next/navigation";

export const metadata = {
  title: "상단바 인디케이터 — DEV",
  description: "개발 전용: 패치노트와 장난감 상자 인디케이터",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function NavIndicatorsDevRoute() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: NavIndicatorsDevPage } = await import("./nav-indicators-dev-page");
  return <NavIndicatorsDevPage />;
}

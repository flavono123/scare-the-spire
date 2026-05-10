import { notFound } from "next/navigation";

export const metadata = {
  title: "인챈트먼트 — DEV",
  description: "DEV — STS2 인챈트먼트 아이콘/데이터 미리보기",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EnchantmentsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: EnchantmentsDevPage } = await import("./enchantments-dev-page");
  return <EnchantmentsDevPage />;
}

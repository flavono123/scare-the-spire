import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";

export const metadata = {
  title: "Supabase Admin — DEV",
  description: "개발 전용 Supabase 컨텐츠 확인 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SupabaseAdminPage() {
  if (!devToolsEnabled()) {
    notFound();
  }

  const { default: SupabaseAdminDevPage } = await import("./admin-dev-page");
  return <SupabaseAdminDevPage />;
}

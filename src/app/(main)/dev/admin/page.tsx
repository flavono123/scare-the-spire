import { notFound } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Supabase Admin — DEV",
  description: "개발 전용 Supabase 컨텐츠 확인 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

interface SupabaseAdminPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SupabaseAdminPage({ searchParams }: SupabaseAdminPageProps) {
  if (!devToolsEnabled()) {
    notFound();
  }

  const contactSave = (await searchParams).contactSave;
  const contactSaveResult = contactSave === "saved" || contactSave === "error"
    ? contactSave
    : undefined;
  const { default: SupabaseAdminDevPage } = await import("./admin-dev-page");
  return <SupabaseAdminDevPage contactSaveResult={contactSaveResult} />;
}

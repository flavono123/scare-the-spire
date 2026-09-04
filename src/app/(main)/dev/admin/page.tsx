import { notFound } from "next/navigation";
import {
  isAdminCommentService,
  isAdminPostService,
} from "@/lib/admin-rls-activity";
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

  const params = await searchParams;
  const contactSave = params.contactSave;
  const contactSaveResult = contactSave === "saved" || contactSave === "error"
    ? contactSave
    : undefined;
  const nicksSave = params.nicksSave;
  const nicksSaveResult = nicksSave === "saved" || nicksSave === "error" || nicksSave === "invalid"
    ? nicksSave
    : undefined;
  const posts = typeof params.posts === "string" ? params.posts : undefined;
  const comments = typeof params.comments === "string" ? params.comments : undefined;
  const { default: SupabaseAdminDevPage } = await import("./admin-dev-page");
  return (
    <SupabaseAdminDevPage
      contactSaveResult={contactSaveResult}
      nicksSaveResult={nicksSaveResult}
      postService={isAdminPostService(posts) ? posts : null}
      commentService={isAdminCommentService(comments) ? comments : null}
    />
  );
}

import { notFound } from "next/navigation";

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
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const [{ isAdminCommentService, isAdminPostService }, { isAdminTabId }, { default: SupabaseAdminDevPage }] =
      await Promise.all([
        import("@/lib/admin-rls-activity"),
        import("./admin-tab-ids"),
        import("./admin-dev-page"),
      ]);
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
    return (
      <SupabaseAdminDevPage
        contactSaveResult={contactSaveResult}
        nicksSaveResult={nicksSaveResult}
        postService={isAdminPostService(posts) ? posts : null}
        commentService={isAdminCommentService(comments) ? comments : null}
        tab={isAdminTabId(params.tab) ? params.tab : undefined}
      />
    );
  }
  notFound();
}

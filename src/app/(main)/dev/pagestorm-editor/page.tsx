import { notFound } from "next/navigation";

export const metadata = {
  title: "서류 작성기 목 — DEV",
  description: "개발 전용: 서류 폭풍 웹 문서 에디터 엔진 비교",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function PagestormEditorPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: PagestormEditorIndex } = await import("./pagestorm-editor-index");
  return <PagestormEditorIndex />;
}

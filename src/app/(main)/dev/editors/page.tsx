import { notFound } from "next/navigation";

export const metadata = {
  title: "에디터 모음 — DEV",
  description: "개발 전용: 서비스의 모든 에디터를 한 페이지에서 입력해 보는 테스트 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EditorsDevPage() {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const { default: EditorsDevPageClient } = await import("./editors-dev-page");
    return <EditorsDevPageClient />;
  }
  notFound();
}

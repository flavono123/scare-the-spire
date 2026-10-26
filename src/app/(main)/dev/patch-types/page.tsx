import { notFound } from "next/navigation";

export const metadata = {
  title: "패치노트 카탈로그 — DEV",
  description: "개발 전용: 패치노트의 모든 타입, 상태, 뱃지, 뷰 쇼케이스",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DevPatchTypesPage() {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const { default: PatchTypesDevPage } = await import("./patch-types-dev-page");
    return <PatchTypesDevPage />;
  }
  notFound();
}

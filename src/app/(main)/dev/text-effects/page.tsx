import { notFound } from "next/navigation";

export const metadata = {
  title: "텍스트 효과 레퍼런스 — DEV",
  description: "개발 전용: Spire BBCode 텍스트 효과 카탈로그",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TextEffectsPage() {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const { default: TextEffectsDevPage } = await import("./text-effects-dev-page");
    return <TextEffectsDevPage />;
  }
  notFound();
}

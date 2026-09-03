import { notFound } from "next/navigation";

export const metadata = {
  title: "프로필 저장 전환 — DEV",
  description: "개발 전용: 익명 닉과 저장한 프로필 닉을 전환",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function DevProfileSwitchPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: DevProfileSwitchPageClient } = await import("./profile-switch-dev-page");
  return <DevProfileSwitchPageClient />;
}

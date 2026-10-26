import { notFound } from "next/navigation";

export const metadata = {
  title: "몬스터 정리 — DEV",
  description: "DEV — bestiary에서 숨기거나 보정하는 몬스터 분류",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DevMonstersRoute() {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const { default: DevMonstersPage } = await import("./monsters-dev-page");
    return <DevMonstersPage />;
  }
  notFound();
}

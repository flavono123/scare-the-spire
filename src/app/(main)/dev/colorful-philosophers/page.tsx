import { notFound } from "next/navigation";

export const metadata = {
  title: "다채로운 철학자들 글 — DEV",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default async function ColorfulPhilosophersDevRoute() {
  // NODE_ENV is inlined at build time, so production builds drop this branch.
  if (process.env.NODE_ENV === "development") {
    const { ColorfulPhilosophersDevPage } = await import("./colorful-philosophers-dev-page");
    return <ColorfulPhilosophersDevPage />;
  }
  notFound();
}

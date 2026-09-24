import { notFound } from "next/navigation";

export const metadata = {
  title: "배달원 토큰 — DEV",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default async function CourierTokensPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { CourierTokensDevPage } = await import("./courier-tokens-dev-page");
  return <CourierTokensDevPage />;
}

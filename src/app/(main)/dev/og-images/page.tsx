import { notFound } from "next/navigation";

export const metadata = {
  title: "OG 이미지 현황 — DEV",
  description: "개발 전용: 페이지별 OG 이미지 매핑 현황",
  robots: {
    index: false,
    follow: false,
  },
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OgImagesDevPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // DEV_TOOLS_BUILD is inlined at build time, so production builds drop this branch.
  if (process.env.DEV_TOOLS_BUILD === "1") {
    const resolvedSearchParams = await searchParams;
    const { default: OgImagesDevDashboard } = await import("./og-images-dev-page");
    return <OgImagesDevDashboard previewPath={firstParam(resolvedSearchParams.path)} />;
  }
  notFound();
}

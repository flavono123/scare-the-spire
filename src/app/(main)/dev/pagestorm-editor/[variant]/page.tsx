import { notFound } from "next/navigation";
import {
  isPagestormEditorVariant,
  PAGESTORM_EDITOR_VARIANTS,
} from "../variants";

export const metadata = {
  title: "서류 작성기 목 — DEV",
  description: "개발 전용: 서류 폭풍 웹 문서 에디터 엔진 비교",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return PAGESTORM_EDITOR_VARIANTS.map((variant) => ({ variant: variant.id }));
}

export default async function PagestormEditorVariantRoute({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { variant } = await params;
  if (!isPagestormEditorVariant(variant)) {
    notFound();
  }

  const { default: PagestormEditorVariantPage } = await import(
    "../pagestorm-editor-variant-page"
  );
  return <PagestormEditorVariantPage variantId={variant} />;
}

import type { Metadata } from "next";
import {
  generateNeowsletterStaticParams,
  getNeowsletterDetailMetadata,
  NeowsletterDetailPage,
} from "@/components/patches/neowsletter-detail-page";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = generateNeowsletterStaticParams;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issue: string }>;
}): Promise<Metadata> {
  const { issue } = await params;
  return getNeowsletterDetailMetadata({ issueId: issue, serviceLocale: "ko" });
}

export default async function KoreanNeowsletterDetailPage({
  params,
}: {
  params: Promise<{ issue: string }>;
}) {
  const { issue } = await params;
  return <NeowsletterDetailPage issueId={issue} serviceLocale="ko" gameLocale="kor" />;
}

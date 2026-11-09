import type { Metadata } from "next";
import {
  PatchDetailPage,
  generatePatchDetailStaticParams,
  getPatchDetailMetadata,
} from "@/components/patches/patch-detail-page";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = generatePatchDetailStaticParams;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>;
}): Promise<Metadata> {
  const { version } = await params;
  return getPatchDetailMetadata({ version, serviceLocale: "ko" });
}

export default async function KoreanPatchDetailPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  return <PatchDetailPage version={version} serviceLocale="ko" gameLocale="kor" reels="none" />;
}

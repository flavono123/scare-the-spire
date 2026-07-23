import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getResourcePatchIndexMetadata,
  ResourcePatchIndexPage,
} from "@/components/patches/resource-patch-index-page";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-static";

export const metadata: Metadata = getResourcePatchIndexMetadata("ko");

export default function PatchChangesPage() {
  if (!devToolsEnabled()) notFound();
  return <ResourcePatchIndexPage serviceLocale="ko" gameLocale="kor" />;
}

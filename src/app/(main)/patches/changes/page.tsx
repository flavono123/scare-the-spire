import type { Metadata } from "next";
import {
  getResourcePatchIndexMetadata,
  ResourcePatchIndexPage,
} from "@/components/patches/resource-patch-index-page";

export const dynamic = "force-static";

export const metadata: Metadata = getResourcePatchIndexMetadata("ko");

export default function PatchChangesPage() {
  return <ResourcePatchIndexPage serviceLocale="ko" gameLocale="kor" />;
}

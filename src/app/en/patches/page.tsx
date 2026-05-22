import type { Metadata } from "next";
import {
  PatchListPage,
  getPatchListMetadata,
} from "@/components/patches/patch-list-page";

export const dynamic = "force-static";

export const metadata: Metadata = getPatchListMetadata("en");

export default function EnglishPatchesPage() {
  return <PatchListPage serviceLocale="en" gameLocale="eng" />;
}

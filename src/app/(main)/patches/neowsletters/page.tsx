import type { Metadata } from "next";
import {
  getNeowsletterListMetadata,
  NeowsletterListPage,
} from "@/components/patches/neowsletter-list-page";

export const dynamic = "force-static";

export const metadata: Metadata = getNeowsletterListMetadata("ko");

export default function KoreanNeowsletterListPage() {
  return <NeowsletterListPage serviceLocale="ko" gameLocale="kor" />;
}

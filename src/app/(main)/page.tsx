import type { Metadata } from "next";
import { renderHome } from "./page-content";
import { withKoreanSearchCanonical } from "@/lib/search-canonical";
import { getDefaultServiceMetadata } from "@/lib/service-metadata";

export const metadata: Metadata = withKoreanSearchCanonical(
  getDefaultServiceMetadata("ko"),
  "/",
);

export default async function Home() {
  return renderHome();
}

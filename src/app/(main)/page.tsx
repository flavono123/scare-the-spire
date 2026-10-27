import type { Metadata } from "next";
import { renderHome } from "./page-content";
import { getHomeServiceMetadata } from "@/lib/service-metadata";

export const metadata: Metadata = getHomeServiceMetadata("ko");

export default async function Home() {
  return renderHome();
}

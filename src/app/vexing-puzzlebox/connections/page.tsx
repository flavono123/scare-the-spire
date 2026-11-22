import type { Metadata } from "next";
import { generateConnectionsMetadata, renderConnectionsPage } from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateConnectionsMetadata();
}

export default async function ConnectionsPage() {
  return renderConnectionsPage();
}

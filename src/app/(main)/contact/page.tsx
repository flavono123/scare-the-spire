import type { Metadata } from "next";
import { generateContactMetadata, renderContactPage } from "./page-content";

export function generateMetadata(): Metadata {
  return generateContactMetadata();
}

export default async function ContactRoute() {
  return renderContactPage();
}

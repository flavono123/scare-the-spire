import type { Metadata } from "next";
import { generateMenuMetadata, renderMenuPage } from "./page-content";

export function generateMetadata(): Metadata {
  return generateMenuMetadata();
}

export default function MenuPage() {
  return renderMenuPage();
}

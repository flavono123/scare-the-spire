import type { Metadata } from "next";
import { generateToyboxMetadata, renderToyboxPage } from "./page-content";

export function generateMetadata(): Metadata {
  return generateToyboxMetadata();
}

export default function ToyboxPage() {
  return renderToyboxPage();
}

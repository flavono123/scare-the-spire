import type { Metadata } from "next";
import {
  generateByrdispatchMetadata,
  renderByrdispatchPage,
} from "./page-content";

export function generateMetadata(): Metadata {
  return generateByrdispatchMetadata();
}

export default async function ByrdispatchPage() {
  return renderByrdispatchPage();
}

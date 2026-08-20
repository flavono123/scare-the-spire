import type { Metadata } from "next";
import {
  generateDefragmentMetadata,
  renderDefragmentPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateDefragmentMetadata();
}

export default async function DefragmentPage() {
  return renderDefragmentPage();
}

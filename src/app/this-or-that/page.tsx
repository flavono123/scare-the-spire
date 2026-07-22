import type { Metadata } from "next";
import {
  generateThisOrThatMetadata,
  renderThisOrThatPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateThisOrThatMetadata();
}

export default async function ThisOrThatPage() {
  return renderThisOrThatPage();
}

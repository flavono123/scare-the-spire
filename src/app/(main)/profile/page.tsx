import type { Metadata } from "next";
import {
  generateProfileMetadata,
  renderProfilePage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateProfileMetadata();
}

export default async function ProfileDevRoute() {
  return renderProfilePage();
}
